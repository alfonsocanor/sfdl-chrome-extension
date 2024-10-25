import { LightningElement, api } from 'lwc';
import { showToastEvent, getValueLocalStorage, clearLocalStorage } from 'sfdl/utils';

export default class Picklist extends LightningElement {
    searchIcon = '/slds/icons/utility/search.svg';
    localStorageIcon = '/slds/icons/utility/bucket.svg';

    picklist;
    areOptionsOpened = false;
    @api placeholper;
    valueSelected;
    queryWhere = '';
    customDisable = 'pointer-events: none; opacity: 0.4;';

    sessionInformation = {
        authToken: '',
        instanceUrl: ''
    };

    futureFunctionality = true;
    
    connectedCallback(){
        this.valueSelected = this.placeholper ? this.placeholper : 'Pick up an org...';
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