import { LightningElement, api } from 'lwc';
import { analyseOptions } from 'sfdl/logDetailsManipulation';
import { adoptStyleSheet } from 'sfdl/styleSheets';
import { css } from './logManipulationMenuCss';

const PILL_CLASS = 'sfdl-log-filter__pill';

//The filters of a log, one pill each, on while blue. A click turns one on or
//off and hands the whole selection on.
export default class LogManipulationMenu extends LightningElement{
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

    connectedCallback(){
        adoptStyleSheet(css);
    }

    get pills(){
        return this.manipulationOptions.map(option => ({
            ...option,
            pillClass: PILL_CLASS + (option.checked ? ' ' + PILL_CLASS + '_on' : ''),
            ariaPressed: option.checked ? 'true' : 'false'
        }));
    }

    handleToggle(event){
        const name = event.currentTarget.dataset.name;

        this.manipulationOptions = this.manipulationOptions.map(option =>
            option.name === name ? { ...option, checked: !option.checked } : option
        );

        this.dispatchEvent(new CustomEvent('checkboxselection', {
            detail: { manipulationOptions: this.manipulationOptions }
        }));
    }

    @api
    currentManipulationOptions(){
        return this.manipulationOptions;
    }
}
