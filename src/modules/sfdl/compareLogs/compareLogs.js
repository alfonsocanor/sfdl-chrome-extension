import { LightningElement, api } from 'lwc';
import { getApexLogBody } from 'sfdl/salesforceConnection';
import { manipulationDetailLogs, normalizeLogForCompare, analyseOptions, compareOptions } from 'sfdl/logDetailsManipulation';
import { showToastEvent } from 'sfdl/utils';
import { adoptStyleSheet } from 'sfdl/styleSheets';
import { adoptCompareTheme } from 'sfdl/compareTheme';
import { css } from './compareLogsCss';

const LEFT = 'left';
const RIGHT = 'right';
const SAME_ORG = 'sameOrg';
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

//What a side shows: a log of an org.
function sideKey(side){
    return side ? side.sessionInformation.instanceUrl + '|' + side.log.id : undefined;
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

//Two logs side by side. Of two orgs: the logs of the left org, the two logs,
//and the logs of the right org. Of the same org: its logs, two of them ticked,
//and the two logs.
export default class CompareLogs extends LightningElement{
    @api orgs = [];
    @api height;
    //twoOrgs or sameOrg.
    @api scope = 'twoOrgs';

    //Two logs of the org of the log list, ticked there to compare them side
    //by side: { left, right }, each { log, sessionInformation }, the older log
    //on the left. They are ticked here as if picked one after the other.
    @api
    get pair(){
        return this._pair;
    }
    set pair(pair){
        this._pair = pair;

        if(pair){
            const { instanceUrl, authToken } = pair.left.sessionInformation;
            this.leftOrgSession = { instanceUrl, authToken };
            this.left = { log: pair.left.log, sessionInformation: this.leftOrgSession };
            this.right = { log: pair.right.log, sessionInformation: this.leftOrgSession };
            this.lastPickedSide = RIGHT;
            this.refreshComparison();
        }
    }

    @api
    get sessionInformation(){
        return this._sessionInformation;
    }
    set sessionInformation(sessionInformation){
        this._sessionInformation = sessionInformation;

        //The left side starts on the org of the log list, and goes its own way
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
    //The side whose new log is on its way while the other one stays on screen.
    pendingSide;
    //The raw bodies of the logs on screen, filtered again when an option
    //changes, and which log of which org each one is.
    leftBody;
    rightBody;
    shownKeys = {};
    comparisonSequence = 0;
    //Of the same org, the side a new tick replaces once both are taken.
    lastPickedSide = RIGHT;
    //Before two logs are picked there is nothing to filter or count.
    hideEmptySummary = true;
    //The filters both logs go through, kept here so a menu built again starts
    //from them.
    options = [...analyseOptions(), ...compareOptions()];

    connectedCallback(){
        adoptStyleSheet(css);
        adoptCompareTheme();
    }

    get isSameOrg(){
        return this.scope === SAME_ORG;
    }

    get isTwoOrgs(){
        return !this.isSameOrg;
    }

    get hasComparison(){
        return this.isLoadingLogs || !!this.pendingSide ||
            typeof this.leftContent === 'string' || typeof this.rightContent === 'string';
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

        return this.isSameOrg ?
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

    get allOrgOptions(){
        return this.orgOptionsBesides(undefined);
    }

    get leftOrgUrl(){
        return this.leftOrgSession ? this.leftOrgSession.instanceUrl : undefined;
    }

    get rightOrgUrl(){
        return this.rightOrgSession ? this.rightOrgSession.instanceUrl : undefined;
    }

    //The where clause of the log list belongs to the analyse list, each side
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

        if(this.isSameOrg){
            return this.left || this.right ?
                'Now tick a second log.' :
                'Tick two logs of the list to compare them.';
        }

        if(this.left && !this.right){
            return 'Now pick the log for the right side.';
        }

        if(this.right && !this.left){
            return 'Now pick the log for the left side.';
        }

        return 'Pick a log on each side to compare them.';
    }

    get pendingMessage(){
        return this.pendingSide ? 'Downloading the ' + this.pendingSide + ' log...' : undefined;
    }

    handleOrgChange(event){
        const side = event.currentTarget.dataset.side;
        const otherOrgUrl = side === LEFT ? this.rightOrgUrl : this.leftOrgUrl;
        const org = (this.orgs || []).find(candidate => candidate.label === event.detail.value);

        if(!org || (this.isTwoOrgs && org.label === otherOrgUrl)){
            return;
        }

        this[side + 'OrgSession'] = { instanceUrl: org.label, authToken: org.value };

        //Of the same org, both logs belonged to the org it had before.
        if(this.isSameOrg){
            this.left = null;
            this.right = null;
            this.refreshComparison();
            return;
        }

        //The log of that side belonged to the org it had before.
        if(this[side]){
            this[side] = null;
            this.refreshComparison();
        }
    }

    //A log clicked on the side it is already on comes off it.
    handleLogSelect(event){
        const { log, side } = event.detail;

        if(this.isSameOrg){
            this.tickLog(log);
            return;
        }

        if(this[side] && this[side].log.id === log.id){
            this[side] = null;
        } else {
            this[side] = { log, sessionInformation: this[side + 'OrgSession'] };
        }

        this.refreshComparison();
    }

    //Of the same org, two logs are ticked at most. A ticked log clicked again
    //comes off, a new one takes a free side, or else the side of the log
    //ticked last, so the other one stays to compare against.
    tickLog(log){
        const tickedSide = [LEFT, RIGHT].find(side => this[side] && this[side].log.id === log.id);

        if(tickedSide){
            this[tickedSide] = null;
        } else {
            const side = !this.left ? LEFT : !this.right ? RIGHT : this.lastPickedSide;
            this[side] = { log, sessionInformation: this.leftOrgSession };
            this.lastPickedSide = side;
        }

        this.refreshComparison();
    }

    async refreshComparison(){
        const sequence = ++this.comparisonSequence;
        const sides = [this.left, this.right];

        //The first log starts downloading while the second one is picked.
        sides.filter(side => side).forEach(side => {
            downloadLogBody(side.sessionInformation, side.log).catch(() => {});
        });

        if(!this.left || !this.right){
            this.clearComparison();
            return;
        }

        const changedSides = [LEFT, RIGHT].filter(side => this.shownKeys[side] !== sideKey(this[side]));
        const isDiffOnScreen = typeof this.leftContent === 'string' && typeof this.rightContent === 'string';

        if(!changedSides.length){
            return;
        }

        //Only the side whose log changed waits, the other one stays on screen.
        if(isDiffOnScreen && changedSides.length === 1){
            this.pendingSide = changedSides[0];
        } else {
            this.pendingSide = undefined;
            this.leftContent = undefined;
            this.rightContent = undefined;
            this.isLoadingLogs = true;
        }

        const [leftResult, rightResult] = await Promise.allSettled(
            sides.map(side => downloadLogBody(side.sessionInformation, side.log))
        );

        //Another pick came in while these bodies were downloading.
        if(sequence !== this.comparisonSequence){
            return;
        }

        const failedSides = [[LEFT, leftResult], [RIGHT, rightResult]].filter(([, result]) => result.status === 'rejected');

        if(failedSides.length){
            showToastEvent('error', 'The log could not be downloaded', failedSides[0][1].reason.message);
            failedSides.forEach(([side]) => { this[side] = null; });
            this.clearComparison();
            return;
        }

        this.isLoadingLogs = false;
        this.pendingSide = undefined;
        this.leftBody = leftResult.value;
        this.rightBody = rightResult.value;
        this.shownKeys = { left: sideKey(this.left), right: sideKey(this.right) };
        this.renderContents();
    }

    clearComparison(){
        this.leftContent = undefined;
        this.rightContent = undefined;
        this.leftBody = undefined;
        this.rightBody = undefined;
        this.shownKeys = {};
        this.isLoadingLogs = false;
        this.pendingSide = undefined;
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
