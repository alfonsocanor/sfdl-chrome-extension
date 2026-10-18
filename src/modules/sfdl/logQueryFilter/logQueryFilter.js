import { LightningElement } from 'lwc';

const DROPDOWN_CLASS = 'sfdlDropdownMenu slds-dropdown-trigger slds-dropdown-trigger_click';

//The where clause of the log query, typed in a dropdown that closes from its
//own button, its cross, a click anywhere else or Escape.
export default class LogQueryFilter extends LightningElement{
    queryWhere = '';
    filterIcon = '/slds/icons/utility/database.svg';
    closeIcon = '/slds/icons/utility/close.svg';
    placeholder = 'WHERE LogUser.Name = \'Jane Johnson\' AND Operation IN (\'batch apex\', \'/aura\') LIMIT 10';
    isOpen = false;
    isClickInside = false;

    connectedCallback(){
        document.addEventListener('click', this.handleDocumentClick);
        document.addEventListener('keydown', this.handleDocumentKeyDown);
    }

    disconnectedCallback(){
        document.removeEventListener('click', this.handleDocumentClick);
        document.removeEventListener('keydown', this.handleDocumentKeyDown);
    }

    get dropdownClass(){
        return DROPDOWN_CLASS + (this.isOpen ? ' slds-is-open' : '');
    }

    handleOpenCloseMenu(){
        this.isOpen = !this.isOpen;
    }

    //A click inside reaches the document right after, where it keeps the
    //dropdown open.
    handleInsideClick(){
        this.isClickInside = true;
    }

    handleDocumentClick = () => {
        if(this.isClickInside){
            this.isClickInside = false;
            return;
        }

        this.isOpen = false;
    };

    handleDocumentKeyDown = (event) => {
        if(event.key === 'Escape'){
            this.isOpen = false;
        }
    };

    handleQueryWhere(event){
        this.dispatchEvent(new CustomEvent('querywhere',{
            detail: { 
                queryWhere: event.target.value
            }
        }));
    }
}
