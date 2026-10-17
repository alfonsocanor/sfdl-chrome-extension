import { LightningElement, api } from 'lwc';

export default class CompareLogs extends LightningElement{
    @api orgs = [];
    @api sessionInformation;
    @api height;
}
