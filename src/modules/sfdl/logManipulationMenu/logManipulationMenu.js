import { LightningElement, api } from 'lwc';

export default class DropdownMenu extends LightningElement{
    filterIcon = '/slds/icons/utility/filterList.svg';
    closeIcon = '/slds/icons/utility/close.svg';
    isMenuOpen = true;

    manipulationOptions = [
        {
            label: 'ENTRY/EXIT',
            name: 'methodEntryExitCodeUnitStartedFinished2Hierarchy',
            checked: false
        },
        {
            label: 'HEAP_ALLOCATE/STATEMENT_EXECUTE',
            name: 'removeHeapAllocateAndStatementExecute',
            checked:false
        }
    ];

    handleOpenCloseMenu(){
        this.isMenuOpen = !this.isMenuOpen;
        this.addRemoveSldsIsOpenMenuClass(this.isMenuOpen ? 'remove' : 'add');
    }

    addRemoveSldsIsOpenMenuClass(action){
        this.template.querySelector('.sfdlDropdownMenu').classList[action]('slds-is-open');
    }

    handleManipulationOptions(event){
        this.manipulationOptions.forEach((option) => {
            if(option.name === event.detail.function2Execute){
                option.checked = event.detail.checked;
            }
        });

        this.dispatchEvent(new CustomEvent('checkboxselection',{
            detail: { manipulationOptions: this.manipulationOptions }
        }))
    }

    @api
    currentManipulationOptions(){
        return this.manipulationOptions;
    }
}