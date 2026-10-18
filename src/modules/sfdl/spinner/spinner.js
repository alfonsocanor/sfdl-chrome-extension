import { LightningElement, api } from 'lwc';
import { adoptStyleSheet } from 'sfdl/styleSheets';
import { css } from './spinnerCss';

//The brand spinner of slds over what is loading, and what is loading written
//under it when there is a message.
export default class Spinner extends LightningElement{
    @api assistiveText;
    @api message;

    connectedCallback(){
        adoptStyleSheet(css);
    }
}
