import { LightningElement, api } from 'lwc';
import { getApexLogBody } from 'sfdl/salesforceConnection';
import { manipulationDetailLogs, normalizeLogForCompare, analyseOptions, compareOptions } from 'sfdl/logDetailsManipulation';
import { showToastEvent } from 'sfdl/utils';
import { adoptStyleSheet } from 'sfdl/styleSheets';
import { adoptCompareTheme } from 'sfdl/compareTheme';
import { css } from './compareLogsCss';

const LEFT = 'left';
const RIGHT = 'right';
const SWAP_ICON = '/slds/icons/utility/sort.svg';
const COMPARE_OPTION_NAMES = compareOptions().map(({ name }) => name);
//Debug logs run to megabytes, only the latest ones are kept around.
const LOG_BODIES_TO_KEEP = 20;

//Bodies already downloaded, by org and log, so going back to a log or
//changing a filter does not download it again.
const logBodies = new Map();

//acme from acme.my.salesforce.com, acme--uat from its sandbox.
function shortOrgName(instanceUrl){
    return instanceUrl.replace('https://', '').split('.')[0];
}

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

//A log of one org against a log of another one: the logs of the left org, the
//two logs, and the logs of the right org.
export default class CompareLogs extends LightningElement{
    @api orgs = [];
    @api height;

    @api
    get sessionInformation(){
        return this._sessionInformation;
    }
    set sessionInformation(sessionInformation){
        this._sessionInformation = sessionInformation;

        //The left side starts on the org of the header, and goes its own way
        //as soon as it has one.
        if(!this.leftOrgSession){
            this.leftOrgSession = this.headerOrgSession();
        }
    }

    _sessionInformation;
    //{ log, sessionInformation } of each side, null while a side is empty.
    left = null;
    right = null;
    //The org of each side, { instanceUrl, authToken }.
    leftOrgSession;
    rightOrgSession;
    leftContent;
    rightContent;
    isLoadingLogs = false;
    //The raw bodies of the logs on screen, filtered again when an option changes.
    leftBody;
    rightBody;
    comparisonSequence = 0;
    swapIcon = SWAP_ICON;
    //The filters both logs go through. The menu lives in the bar of the diff,
    //which comes and goes with it, so the comparison keeps them.
    options = [...analyseOptions(), ...compareOptions()];

    connectedCallback(){
        adoptStyleSheet(css);
        adoptCompareTheme();
    }

    get containerStyle(){
        return this.height ? 'height:' + this.height + 'px;' : 'height:100%;';
    }

    get hasHeaderOrg(){
        return !!(this._sessionInformation && this._sessionInformation.instanceUrl);
    }

    get leftLogId(){
        return this.left ? this.left.log.id : undefined;
    }

    get rightLogId(){
        return this.right ? this.right.log.id : undefined;
    }

    get leftLabel(){
        return this.sideLabel(this.left);
    }

    get rightLabel(){
        return this.sideLabel(this.right);
    }

    //Two orgs can hold logs with the very same name, the org tells them apart.
    sideLabel(side){
        if(!side){
            return undefined;
        }

        return shortOrgName(side.sessionInformation.instanceUrl) + ' \u00b7 ' + side.log.name;
    }

    get orgOptions(){
        return (this.orgs || []).map(org => ({ label: org.label.replace('https://', ''), value: org.label }));
    }

    get leftOrgUrl(){
        return this.leftOrgSession ? this.leftOrgSession.instanceUrl : undefined;
    }

    get rightOrgUrl(){
        return this.rightOrgSession ? this.rightOrgSession.instanceUrl : undefined;
    }

    get leftOrgLabel(){
        return this.leftOrgUrl ? this.leftOrgUrl.replace('https://', '') : 'No org picked yet';
    }

    get rightOrgLabel(){
        return this.rightOrgUrl ? this.rightOrgUrl.replace('https://', '') : 'No org picked yet';
    }

    //The where clause of the header belongs to the analyse list, each side
    //here filters its own list.
    headerOrgSession(){
        return this.hasHeaderOrg ?
            { instanceUrl: this._sessionInformation.instanceUrl, authToken: this._sessionInformation.authToken } :
            undefined;
    }

    get emptyMessage(){
        if(this.left && !this.right){
            return 'Now pick the log for the right side.';
        }

        if(this.right && !this.left){
            return 'Now pick the log for the left side.';
        }

        return 'Pick a log on each side to compare them.';
    }

    get isSwapDisabled(){
        return !this.left && !this.right && !this.leftOrgSession && !this.rightOrgSession;
    }

    //Each side keeps its colour, what moves is the content: the orgs and their
    //logs.
    handleSwap(){
        [this.left, this.right] = [this.right, this.left];
        [this.leftOrgSession, this.rightOrgSession] = [this.rightOrgSession, this.leftOrgSession];

        this.refreshComparison();
    }

    handleOrgChange(event){
        const side = event.currentTarget.dataset.side;
        const org = (this.orgs || []).find(candidate => candidate.label === event.detail.value);

        if(!org){
            return;
        }

        this[side + 'OrgSession'] = { instanceUrl: org.label, authToken: org.value };

        //The log of that side belonged to the org it had before.
        if(this[side]){
            this[side] = null;
            this.refreshComparison();
        }
    }

    //A log clicked on the side it is already on comes off it.
    handleLogSelect(event){
        const { log, side } = event.detail;

        if(this[side] && this[side].log.id === log.id){
            this[side] = null;
        } else {
            this[side] = { log, sessionInformation: this[side + 'OrgSession'] };
        }

        this.refreshComparison();
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

        const manipulationOptions = this.options.filter(({ name }) => !COMPARE_OPTION_NAMES.includes(name));
        const logCompareOptions = this.options.filter(({ name }) => COMPARE_OPTION_NAMES.includes(name));
        const prepare = body => normalizeLogForCompare(manipulationDetailLogs(body, manipulationOptions), logCompareOptions);

        this.leftContent = prepare(this.leftBody);
        this.rightContent = prepare(this.rightBody);
    }

    handleOptionsChange(event){
        this.options = event.detail.manipulationOptions.map(option => ({ ...option }));
        this.renderContents();
    }
}
