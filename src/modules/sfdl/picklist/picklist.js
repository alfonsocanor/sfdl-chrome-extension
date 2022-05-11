import { LightningElement, api } from 'lwc';

export default class Picklist extends LightningElement {
    @api picklist;
    areOptionsOpened = false;
    @api placeholper;
    valueSelected;

    connectedCallback(){
        this.valueSelected = this.placeholper ? this.placeholper : 'Select value';
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
        const sessionInformation = {
            authToken: event.target.dataset.sid,
            instanceUrl: this.valueSelected
        }

        this.dispatchEvent(new CustomEvent('sessioninformation',{
            detail: { 
                sessionInformation
            }
        }));
    }
}