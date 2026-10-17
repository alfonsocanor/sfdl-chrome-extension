import { LightningElement, api } from 'lwc';

export default class CompareOrgs extends LightningElement{
    @api orgs = [];
    @api sessionInformation;
    @api height;
}
