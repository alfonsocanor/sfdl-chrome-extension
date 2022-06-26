import { LightningElement } from 'lwc';

export default class LogQueryFilter extends LightningElement{
    queryWhere = '';
    filterIcon = '/slds/icons/utility/database.svg';
    closeIcon = '/slds/icons/utility/close.svg';
    isMenuOpen = true;
    placeholder = 'WHERE CreatedBy.Name = \'john wick\' LIMIT 10';

    handleOpenCloseMenu(){
        this.isMenuOpen = !this.isMenuOpen;
        this.addRemoveSldsIsOpenMenuClass(this.isMenuOpen ? 'remove' : 'add');
    }

    handleQueryWhere(event){
        console.log('@event.detail.value');
        this.dispatchEvent(new CustomEvent('querywhere',{
            detail: { 
                queryWhere: event.target.value
            }
        }));
    }

    addRemoveSldsIsOpenMenuClass(action){
        this.template.querySelector('.sfdlDropdownMenu').classList[action]('slds-is-open');
    }
}