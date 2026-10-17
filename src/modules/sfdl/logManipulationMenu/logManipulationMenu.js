import { LightningElement, api } from 'lwc';
import { compareOptions } from 'sfdl/logDetailsManipulation';

export default class DropdownMenu extends LightningElement{
    manipulationOptions = [
        {
            label: 'ENTRY/EXIT/END/BEGIN',
            name: 'methodEntryExitCodeUnitStartedFinished2Hierarchy',
            checked: true
        },
        {
            label: 'HEAP_ALLOCATE/STATEMENT_EXECUTE',
            name: 'removeHeapAllocateAndStatementExecute',
            checked: true
        },
        {
            label: 'FLOW/LIMIT/INTERVIEW',
            name: 'removeFlowNoise',
            checked: true
        }
    ];
    
    //The compare tabs add the options that only make sense between two logs.
    @api withCompareOptions = false;

    filterIcon = '/slds/icons/utility/filterList.svg';
    closeIcon = '/slds/icons/utility/close.svg';
    isMenuOpen = true;

    connectedCallback(){
        if(this.withCompareOptions){
            this.manipulationOptions = [...this.manipulationOptions, ...compareOptions()];
        }
    }

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