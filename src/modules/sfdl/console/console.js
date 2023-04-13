import { LightningElement, track } from 'lwc';
import { getAllCookiesFromSalesforceDomain, isSessionInformationValid } from 'sfdl/authentication';
import { showToastEvent } from 'sfdl/utils';

const tabNavigation = {
    analyseLogs:{tab:'.liElementAnalyseLogs', body:'.sfdl-analise-logs', open:'openAnaliseLogs'},
    compareLogs:{tab:'.liElementCompareLogs', body:'.sfdl-compare-logs', open:'openCompareLogs'},
    compareOrgs:{tab:'.liElementCompareOrgs', body:'.sfdl-compare-orgs', open:'openCompareOrgs'}
}

export default class Console extends LightningElement {
    firstRender = true;
    showLogListSection = true;
    renderLogList = false;
    
    toastAction;
    toastHeader;
    toastMessage;
    
    manipulationOptions;

    openAnaliseLogs=true;
    openCompareLogs=false;
    openCompareOrgs=true;

    logList = [];
    isDownloadInProgress = false;

    sectionStyle = 'background-color:#fafaf9;position:relative;overflow:hidden;display:flex;';

    @track picklistInformation = [];
    @track sessionInformation;

    resetConsoleProperties(){
        this.showLogListSection = true;
        this.renderLogList = false;
        this.manipulationOptions = {};
        this.openAnaliseLogs=true;
        this.openCompareLogs=false;
        this.openCompareOrgs=true;
        this.logList = [];
        this.isDownloadInProgress = false;
        this.picklistInformation = [];
        this.sessionInformation = {};
    }

    connectedCallback(){
        this.init();
        window.addEventListener('resize', this.updateHeight.bind(this));
    }

    renderedCallback() {
        if(this.firstRender) {
            this.updateHeight()
            this.firstRender = false;
        }
    }

    updateHeight(){
        let sfdlConsoleHeader = this.template.querySelector('.sfdl-console-header');
        let sfdlFooterContainer = this.template.querySelector('.sfdl-footer-container');
        let tabs = this.template.querySelector('.slds-tabs_scoped__nav');
        let sfdlBodyTab = this.template.querySelector('.sfdl-body-tab');
        var windowHeight = window.innerHeight;
        
        if(sfdlBodyTab) {
            let sfdlBodyTabHeight = (windowHeight - sfdlConsoleHeader.clientHeight - sfdlFooterContainer.clientHeight - tabs.clientHeight - 10);
            sfdlBodyTab.style.height = sfdlBodyTabHeight + 'px';
            this.template.querySelector('sfdl-log-details').setMonacoEditorHeight(sfdlBodyTabHeight - 50);
        }
    }

    async init(){
        const allSalesforceCookies = await getAllCookiesFromSalesforceDomain();
        this.createCookiesSession4SfdlPicklist(allSalesforceCookies);
    }

    async createCookiesSession4SfdlPicklist(allSalesforceCookies){
        allSalesforceCookies.forEach(async cookie => {
            let isAValidSession = await isSessionInformationValid(cookie);
            if(isAValidSession){
                this.picklistInformation.push({ label: 'https://' + cookie.domain, value:cookie.value });
            }
        });
    }

    async handleLogDetails(event){
        let sfdlLogDetailsComponent = this.template.querySelector('sfdl-log-details');
        sfdlLogDetailsComponent.processLogsFromLogList(event.detail.logDetails, event.detail.logName);
    }

    handleIsLoading(){
        let sfdlLogDetailsComponent = this.template.querySelector('sfdl-log-details');
        sfdlLogDetailsComponent.handleIsLoading();
    }

    handleDisplayLogListSection(event){
        this.showLogListSection = !this.showLogListSection;
        this.template.querySelector('.sfdl-console-log-list-section').classList[event.detail.classAction]('slds-is-open');
    }

    hideMonacoEditor(){
        this.template.querySelector('sfdl-log-details').hideMonacoEditor();
    }

    async handleSessionInformation(event){
        this.hideMonacoEditor();
        this.renderLogList = false;
        await new Promise((resolve)=>{setTimeout(resolve, 100);});
        this.renderLogList = true;
        this.sessionInformation = event.detail.sessionInformation;
    }

    async handleActivateActionButtons(){
            this.template.querySelector('sfdl-picklist').disableActionButtons(false);
    }

    handleManipulationOptions(event){
        if(this.template.querySelector('sfdl-log-list')){
            this.template.querySelector('sfdl-log-list').handleManipulationOptionsForDownloading(event.detail.manipulationOptions);
        }
    }

    async handleTabNavigation(event){
        if(event.target.dataset.tabname !== 'analyseLogs') {
            this.toastAction = 'warning';
            this.toastHeader = 'Not available';
            this.toastMessage = 'Org team is working on this functionality. It will be available soon! (:';
            showToastEvent(this.toastAction, this.toastHeader, this.toastMessage);
            return;
        }

        this.inactiveAllTabs();
        this.activateTab(event);
        this.hideAllContent();
        this.showContentBasedOnTab(event);
    }

    noLogs2Compare(event){
        return event.target.dataset.tabname === 'compareLogs' && !this.logList.length;
    }

    activateTab(event){
        this[tabNavigation[event.target.dataset.tabname].open] = true;
        this.template.querySelector(tabNavigation[event.target.dataset.tabname].tab).classList.add('slds-is-active');
    }

    inactiveAllTabs(){
        this.template.querySelectorAll('li').forEach( liElement => {
            liElement.classList.remove('slds-is-active');
        });
    }

    showContentBasedOnTab(event){
        this.template.querySelector(tabNavigation[event.target.dataset.tabname].body).classList.remove('slds-hide');
        this.template.querySelector(tabNavigation[event.target.dataset.tabname].body).classList.add('slds-show');
    }

    hideAllContent(){
        this.template.querySelectorAll('.slds-tabs_scoped__content').forEach( contentElement => {
            contentElement.classList.remove('slds-show');
            contentElement.classList.add('slds-hide');
        });
    }

    handleLogList(event){
        this.logList = event.detail.logList;
        this.openCompareLogs = true;
    }
    
    handleDownloadInProgress2Compare(){
        this.isDownloadInProgress = true;
    }
}