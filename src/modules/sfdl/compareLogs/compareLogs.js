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
const CLOSE_ICON = '/slds/icons/utility/close.svg';
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
//two logs, and the logs of the right org. Handed a pair, it only shows those
//two logs, for two logs of the same org compared from the analyse list.
export default class CompareLogs extends LightningElement{
    @api orgs = [];
    @api height;

    //{ left, right }, each { log, sessionInformation }.
    @api
    get pair(){
        return this._pair;
    }
    set pair(pair){
        this._pair = pair;

        if(pair){
            this.left = pair.left;
            this.right = pair.right;
            this.refreshComparison();
        }
    }

    @api
    get sessionInformation(){
        return this._sessionInformation;
    }
    set sessionInformation(sessionInformation){
        this._sessionInformation = sessionInformation;

        //The left side starts on the org of the header, and goes its own way
        //as soon as it has one, unless the right side has that org already.
        const headerOrgSession = this.headerOrgSession();
        if(!this.leftOrgSession && headerOrgSession && headerOrgSession.instanceUrl !== this.rightOrgUrl){
            this.leftOrgSession = headerOrgSession;
        }
    }

    _sessionInformation;
    _pair;
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
    closeIcon = CLOSE_ICON;
    //The filters both logs go through. The menu lives in the bar of the diff,
    //which comes and goes with it, so the comparison keeps them.
    options = [...analyseOptions(), ...compareOptions()];

    connectedCallback(){
        adoptStyleSheet(css);
        adoptCompareTheme();
    }

    get isPairMode(){
        return !!this._pair;
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

        return this.isPairMode ?
            side.log.name :
            shortOrgName(side.sessionInformation.instanceUrl) + ' \u00b7 ' + side.log.name;
    }

    //Each side offers the orgs the other side has not taken, an org is never
    //compared against itself.
    orgOptionsBesides(takenOrgUrl){
        return (this.orgs || [])
            .filter(org => org.label !== takenOrgUrl)
            .map(org => ({ label: org.label.replace('https://', ''), value: org.label }));
    }

    get leftOrgOptions(){
        return this.orgOptionsBesides(this.rightOrgUrl);
    }

    get rightOrgOptions(){
        return this.orgOptionsBesides(this.leftOrgUrl);
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
        if(this.isLoadingLogs){
            return 'Downloading the two logs...';
        }

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

    //Each side keeps its colour, what moves is the content: the logs, and the
    //orgs they come from.
    handleSwap(){
        [this.left, this.right] = [this.right, this.left];

        if(!this.isPairMode){
            [this.leftOrgSession, this.rightOrgSession] = [this.rightOrgSession, this.leftOrgSession];
        }

        this.refreshComparison();
    }

    handleClose(){
        this.dispatchEvent(new CustomEvent('close'));
    }

    handleOrgChange(event){
        const side = event.currentTarget.dataset.side;
        const otherOrgUrl = side === LEFT ? this.rightOrgUrl : this.leftOrgUrl;
        const org = (this.orgs || []).find(candidate => candidate.label === event.detail.value);

        if(!org || org.label === otherOrgUrl){
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
