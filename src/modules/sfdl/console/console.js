import { LightningElement, track } from 'lwc';
import { getAllCookiesFromSalesforceDomain } from 'sfdl/authentication';

export default class Console extends LightningElement {
    showLogListSection = true;
    renderLogList = false;
    @track picklistInformation = [];
    @track sessionInformation;

    connectedCallback(){
        this.init();
    }

    async init(){
        const allSalesforceCookies = await getAllCookiesFromSalesforceDomain();
        this.picklistInformation = this.createCookiesSession4SfdlPicklist(allSalesforceCookies);
    }

    createCookiesSession4SfdlPicklist(allSalesforceCookies){
        return allSalesforceCookies.map(cookie => ({ label:cookie.domain, value:cookie.value }));
    }

    async handleLogDetails(event){
        let sfdlLogDetailsComponent = this.template.querySelector('sfdl-log-details');
        sfdlLogDetailsComponent.displayLogsDetailsFromLogList(event.detail.logDetails, event.detail.logName);
    }

    handleDisplayLogListSection(event){
        this.showLogListSection = !this.showLogListSection;
        this.template.querySelector('.sfdl-console-log-list-section').classList[event.detail.classAction]('slds-is-open');
    }

    async handleSessionInformation(event){
        this.renderLogList = false;
        await new Promise((resolve)=>{setTimeout(resolve, 100);});
        this.renderLogList = true;
        this.sessionInformation = event.detail.sessionInformation;
    }
}