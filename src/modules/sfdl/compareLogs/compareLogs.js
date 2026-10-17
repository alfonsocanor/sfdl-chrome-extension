import { LightningElement, api } from 'lwc';
import { adoptStyleSheet } from 'sfdl/styleSheets';
import { adoptCompareTheme } from 'sfdl/compareTheme';
import { css } from './compareLogsCss';

const SAME_ORG = 'sameOrg';
const TWO_ORGS = 'twoOrgs';
const LEFT = 'left';
const RIGHT = 'right';
const BUTTON_CLASS = 'slds-button';

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
}
