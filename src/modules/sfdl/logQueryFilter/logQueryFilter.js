import { LightningElement } from 'lwc';

export default class LogQueryFilter extends LightningElement{
    queryWhere = '';
    filterIcon = '/slds/icons/utility/database.svg';
    closeIcon = '/slds/icons/utility/close.svg';
    placeholder = 'WHERE LogUser.Name = \'Jane Johnson\' AND Operation IN (\'batch apex\', \'/aura\') LIMIT 10';
    isMenuOpen = true;

    handleOpenCloseMenu(){
        this.isMenuOpen = !this.isMenuOpen;
        this.addRemoveSldsIsOpenMenuClass(this.isMenuOpen ? 'remove' : 'add');
    }

    addRemoveSldsIsOpenMenuClass(action){
        this.template.querySelector('.sfdlDropdownMenu').classList[action]('slds-is-open');
    }

    handleQueryWhere(event){
        this.dispatchEvent(new CustomEvent('querywhere',{
            detail: { 
                queryWhere: event.target.value
            }
        }));
    }
}