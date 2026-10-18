import { LightningElement, api } from 'lwc';
import { showToastEvent, getValueLocalStorage, clearLocalStorage } from 'sfdl/utils';
import { adoptStyleSheet } from 'sfdl/styleSheets';
import { adoptCompareTheme } from 'sfdl/compareTheme';
import { css } from './picklistCss';

//The address of an org without its scheme, what fits a narrow column.
function withoutScheme(url){
    return url ? url.replace('https://', '') : url;
}

export default class Picklist extends LightningElement {
    searchIcon = '/slds/icons/utility/search.svg';
    localStorageIcon = '/slds/icons/utility/bucket.svg';

    picklist = [];
    areOptionsOpened = false;
    @api placeholder;
    valueSelected;
    queryWhere = '';
    customDisable = 'pointer-events: none; opacity: 0.4;';

    sessionInformation = {
        authToken: '',
        instanceUrl: ''
    };

    futureFunctionality = true;
    
    connectedCallback(){
        adoptStyleSheet(css);
        adoptCompareTheme();
        this.valueSelected = this.placeholder ? this.placeholder : 'Pick up an org...';
    }

    get valueToDisplay(){
        return withoutScheme(this.valueSelected);
    }

    get orgOptions(){
        return this.picklist.map(org => ({ ...org, name: withoutScheme(org.label) }));
    }

    handlerClearLocalStorage(){
        clearLocalStorage();
    }

    async openPicklistOptions(){
        if(!this.picklist.length) {
            showToastEvent(
                'warning','No active org session :(', 'Login as usual to SF you want to analyse and come back. See you in a bit (:');
            return;
        }

        let isDownloadInProgress = await getValueLocalStorage('isDownloadInProgress');
        if(isDownloadInProgress){
            showToastEvent(
                'warning','Download already in progress', 'Hold on tight. Download logs was lauched from another sfdl console.');
            return;
        }

        let classAction = this.areOptionsOpened ? 'remove' : 'add';
        this.areOptionsOpened = !this.areOptionsOpened;
        this.addDeleteHtmlClassOfAnElement(classAction, 'slds-is-open');
    }

    closePicklistIfOnFocus(){
        setTimeout(() => {
            if(this.areOptionsOpened){
                this.openPicklistOptions();
            }
        },200);
    }
    
    addDeleteHtmlClassOfAnElement(action, htmlClassName){
        this.template.querySelector('.slds-combobox').classList[action](htmlClassName);
    }

    async updateSessionInformation(event){
        this.valueSelected = event.target.dataset.domain;
        this.sessionInformation = {
            authToken: event.target.dataset.sid,
            instanceUrl: this.valueSelected,
            queryWhere: this.queryWhere
        }

        await this.queryLogs();

        this.disableActionButtons(false);
    }

    async queryLogs(){
        let isDownloadInProgress = await getValueLocalStorage('isDownloadInProgress');
        if(isDownloadInProgress){
            showToastEvent(
                'warning','Download already in progress', 'Hold on tight. Download logs was lauched from another sfdl console.');
            return;
        }

        this.dispatchEvent(new CustomEvent('sessioninformation',{
            detail: { 
                sessionInformation: this.sessionInformation
            }
        }));

        this.disableActionButtons(true);
    }

    handleQueryWhere(event){
        this.queryWhere = this.sessionInformation.queryWhere = event.detail.queryWhere;
    }

    @api
    disableActionButtons(isDisable){
        this.template.querySelectorAll('.actionButtons').forEach( buttonElement => {
            buttonElement.disabled = isDisable;
        })
    }

    @api
    async setPicklistValues(picklistValues) {
        this.picklist = picklistValues;
        this.customDisable = '';
    }
}