import { LightningElement, api } from 'lwc';
import { analyseOptions } from 'sfdl/logDetailsManipulation';

export default class DropdownMenu extends LightningElement{
    manipulationOptions = analyseOptions();

    //A comparison hands in its own options, the analyse ones and the compare
    //ones, and keeps them when the menu is built again.
    @api
    get options(){
        return this.manipulationOptions;
    }
    set options(options){
        this.manipulationOptions = (options || []).map(option => ({ ...option }));
    }

    filterIcon = '/slds/icons/utility/filterList.svg';
    closeIcon = '/slds/icons/utility/close.svg';
    isMenuOpen = true;

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