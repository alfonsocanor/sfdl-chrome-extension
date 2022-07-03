import { LightningElement, api } from 'lwc';

export default class Picklist extends LightningElement {
    searchIcon = '/slds/icons/utility/search.svg';

    @api picklist;
    areOptionsOpened = false;
    @api placeholper;
    valueSelected;
    queryWhere = '';

    sessionInformation = {
        authToken: '',
        instanceUrl: ''
    };

    connectedCallback(){
        this.valueSelected = this.placeholper ? this.placeholper : 'Pick up an org...';
    }

    openPicklistOptions(){
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

    updateSessionInformation(event){
        this.valueSelected = event.target.dataset.domain;
        this.sessionInformation = {
            authToken: event.target.dataset.sid,
            instanceUrl: this.valueSelected,
            queryWhere: this.queryWhere
        }

        this.disableActionButtons(false);
    }

    queryLogs(){
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
}