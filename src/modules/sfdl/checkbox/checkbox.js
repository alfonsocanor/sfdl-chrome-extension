import { LightningElement, api } from 'lwc';

export default class Checkbox extends LightningElement{
    @api checkboxOptions;

    handleSelection(event){
        this.dispatchEvent(new CustomEvent('checkboxselection',{
            detail: {
                function2Execute: event.target.name,
                checked: event.target.checked
            }
        }))
    }
}