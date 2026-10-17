import { LightningElement, api } from 'lwc';
import { getApexLogBody } from 'sfdl/salesforceConnection';
import { manipulationDetailLogs, normalizeLogForCompare, compareOptions } from 'sfdl/logDetailsManipulation';
import { showToastEvent } from 'sfdl/utils';
import { adoptStyleSheet } from 'sfdl/styleSheets';
import { adoptCompareTheme } from 'sfdl/compareTheme';
import { css } from './compareLogsCss';

const SAME_ORG = 'sameOrg';
const TWO_ORGS = 'twoOrgs';
const LEFT = 'left';
const RIGHT = 'right';
const BUTTON_CLASS = 'slds-button';
const COMPARE_OPTION_NAMES = compareOptions().map(({ name }) => name);
//Debug logs run to megabytes, only the latest ones are kept around.
const LOG_BODIES_TO_KEEP = 20;

//Bodies already downloaded, by org and log, so going back to a log or
//changing a filter does not download it again.
const logBodies = new Map();

function downloadLogBody(sessionInformation, log){
    const key = sessionInformation.instanceUrl + '|' + log.id;

    if(!logBodies.has(key)){
        logBodies.set(key, getApexLogBody(sessionInformation, log).catch(error => {
            logBodies.delete(key);
            throw error;
        }));

        if(logBodies.size > LOG_BODIES_TO_KEEP){
            logBodies.delete(logBodies.keys().next().value);
        }
    }

    return logBodies.get(key);
}

//Two logs side by side, from the same org or from two different ones.
export default class CompareLogs extends LightningElement{
    @api orgs = [];
    @api height;

    @api
    get sessionInformation(){
        return this._sessionInformation;
    }
    set sessionInformation(sessionInformation){
        const hasOrgChanged = !this._sessionInformation || !sessionInformation ||
            this._sessionInformation.instanceUrl !== sessionInformation.instanceUrl;
        this._sessionInformation = sessionInformation;

        //The logs on screen belong to the org that was picked before.
        if(hasOrgChanged && this.isSameOrg){
            this.clearSides();
        }
    }

    _sessionInformation;
    mode = SAME_ORG;
    //{ log, sessionInformation } of each side, null while a side is empty.
    left = null;
    right = null;
    leftContent;
    rightContent;
    isLoadingLogs = false;
    //The raw bodies of the logs on screen, filtered again when an option changes.
    leftBody;
    rightBody;
    comparisonSequence = 0;

    connectedCallback(){
        adoptStyleSheet(css);
        adoptCompareTheme();
    }

    get isSameOrg(){
        return this.mode === SAME_ORG;
    }

    get isTwoOrgs(){
        return this.mode === TWO_ORGS;
    }

    get sameOrgButtonClass(){
        return BUTTON_CLASS + (this.isSameOrg ? ' slds-button_brand' : ' slds-button_neutral');
    }

    get twoOrgsButtonClass(){
        return BUTTON_CLASS + (this.isTwoOrgs ? ' slds-button_brand' : ' slds-button_neutral');
    }

    get isSameOrgPressed(){
        return this.isSameOrg ? 'true' : 'false';
    }

    get isTwoOrgsPressed(){
        return this.isTwoOrgs ? 'true' : 'false';
    }

    get containerStyle(){
        return this.height ? 'height:' + this.height + 'px;' : 'height:100%;';
    }

    get hasHeaderOrg(){
        return !!(this._sessionInformation && this._sessionInformation.instanceUrl);
    }

    get headerOrgLabel(){
        return this.hasHeaderOrg ? this._sessionInformation.instanceUrl.replace('https://', '') : '';
    }

    get leftLogId(){
        return this.left ? this.left.log.id : undefined;
    }

    get rightLogId(){
        return this.right ? this.right.log.id : undefined;
    }

    get leftLabel(){
        return this.left ? this.left.log.name : undefined;
    }

    get rightLabel(){
        return this.right ? this.right.log.name : undefined;
    }

    get hint(){
        return this.isSameOrg ?
            'Click a log to fill the next free side and click it again to take it off, or send it to a side with L and R.' :
            'Pick an org on each side, then click the log to compare on that side.';
    }

    get emptyMessage(){
        if(this.isSameOrg && !this.hasHeaderOrg){
            return 'Pick an org in Organization Instances above, then two of its logs.';
        }

        if(this.left && !this.right){
            return 'Now pick the log for the right side.';
        }

        if(this.right && !this.left){
            return 'Now pick the log for the left side.';
        }

        return 'Pick two logs to compare them side by side.';
    }

    handleModeChange(event){
        const mode = event.currentTarget.dataset.mode;

        if(mode !== this.mode){
            this.mode = mode;
            this.clearSides();
        }
    }

    clearSides(){
        this.left = null;
        this.right = null;
        this.refreshComparison();
    }

    //Both sides read the org of the header while comparing within one org.
    sessionForSide(){
        return this._sessionInformation;
    }

    handleLogSelect(event){
        const { log, side } = event.detail;

        if(side){
            this.toggleSide(side, log);
        } else {
            this.placeLog(log);
        }

        this.refreshComparison();
    }

    //A log sent to the side it is already on comes off it.
    toggleSide(side, log){
        if(this[side] && this[side].log.id === log.id){
            this[side] = null;
        } else {
            this[side] = { log, sessionInformation: this.sessionForSide(side) };
        }
    }

    //A click on a log being compared takes it off, otherwise the log fills the
    //next free side. With both sides taken it replaces the right one, so the
    //left one stays as the reference.
    placeLog(log){
        const sidesWithLog = [LEFT, RIGHT].filter(side => this[side] && this[side].log.id === log.id);

        if(sidesWithLog.length){
            sidesWithLog.forEach(side => { this[side] = null; });
            return;
        }

        const side = !this.left ? LEFT : RIGHT;
        this[side] = { log, sessionInformation: this.sessionForSide(side) };
    }

    async refreshComparison(){
        const sequence = ++this.comparisonSequence;
        const sides = [this.left, this.right];

        this.leftContent = undefined;
        this.rightContent = undefined;
        this.leftBody = undefined;
        this.rightBody = undefined;

        //The first log starts downloading while the second one is picked.
        sides.filter(side => side).forEach(side => {
            downloadLogBody(side.sessionInformation, side.log).catch(() => {});
        });

        if(!this.left || !this.right){
            this.isLoadingLogs = false;
            return;
        }

        this.isLoadingLogs = true;

        const [leftResult, rightResult] = await Promise.allSettled(
            sides.map(side => downloadLogBody(side.sessionInformation, side.log))
        );

        //Another pick came in while these bodies were downloading.
        if(sequence !== this.comparisonSequence){
            return;
        }

        this.isLoadingLogs = false;

        const failedSides = [[LEFT, leftResult], [RIGHT, rightResult]].filter(([, result]) => result.status === 'rejected');

        if(failedSides.length){
            showToastEvent('error', 'The log could not be downloaded', failedSides[0][1].reason.message);
            failedSides.forEach(([side]) => { this[side] = null; });
            return;
        }

        this.leftBody = leftResult.value;
        this.rightBody = rightResult.value;
        this.renderContents();
    }

    //Both logs go through the same filters, the analyse ones first and the
    //compare ones after, so the filters still see each line as the org wrote it.
    renderContents(){
        if(typeof this.leftBody !== 'string' || typeof this.rightBody !== 'string'){
            return;
        }

        const options = this.template.querySelector('sfdl-log-manipulation-menu').currentManipulationOptions();
        const manipulationOptions = options.filter(({ name }) => !COMPARE_OPTION_NAMES.includes(name));
        const logCompareOptions = options.filter(({ name }) => COMPARE_OPTION_NAMES.includes(name));
        const prepare = body => normalizeLogForCompare(manipulationDetailLogs(body, manipulationOptions), logCompareOptions);

        this.leftContent = prepare(this.leftBody);
        this.rightContent = prepare(this.rightBody);
    }

    handleOptionsChange(){
        this.renderContents();
    }
}
