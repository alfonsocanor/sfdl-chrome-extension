import { LightningElement, track } from 'lwc';
import { getAllCookiesFromSalesforceDomain } from 'sfdl/authentication';

export default class Console extends LightningElement {
    showLogListSection = true;
    renderLogList = false;
    
    showToastMessage = false;
    toastAction;
    toastHeader;
    toastMessage;
    toastInProgress = false;
    toastCloseSetTimeoutId;

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

    async handleToastMessage(event){
        await this.closeToastIfOpenWhileAnotherExceptionOccurs();
        this.toastAction = event.detail.action;
        this.toastHeader = event.detail.header;
        this.toastMessage = event.detail.message;
        this.showToastMessage = true;
        this.toastInProgress = true;

        this.toastCloseSetTimeoutId = setTimeout(() => {
            this.showToastMessage = false;
            this.toastInProgress = false;
        },4000);
    }

    async closeToastIfOpenWhileAnotherExceptionOccurs(){
        if(this.toastInProgress){
            clearTimeout(this.toastCloseSetTimeoutId);
            this.showToastMessage = false;
            await new Promise(resolve => setTimeout(resolve, 200));
        }
    }
}