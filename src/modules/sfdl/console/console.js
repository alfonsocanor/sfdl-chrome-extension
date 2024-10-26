import { LightningElement, track } from 'lwc';
import { getAllCookiesFromSalesforceDomain, isSessionInformationValid } from 'sfdl/authentication';
import { showToastEvent } from 'sfdl/utils';
import { css } from './consoleCss';

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
        this.openCompareOrgs=false;
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
            let sfdlBodyTabHeight = (windowHeight - sfdlConsoleHeader.clientHeight - sfdlFooterContainer.clientHeight - tabs.clientHeight - 4);
            sfdlBodyTab.style.height = sfdlBodyTabHeight + 'px';
            this.template.querySelector('sfdl-log-details').setMonacoEditorHeight(sfdlBodyTabHeight - 50);
        }
    }

    async init(){
        this.initializeCustomCss();
        const allSalesforceCookies = await getAllCookiesFromSalesforceDomain();
        this.createCookiesSession4SfdlPicklist(allSalesforceCookies);
    }

    initializeCustomCss() { 
        // Check if the custom CSS is already loaded
        if (!document.adoptedStyleSheets.some(sheet => sheet instanceof CSSStyleSheet && sheet.replaceSync === css.replaceSync)) {
            const sheet = new CSSStyleSheet();
            sheet.replaceSync(css);
            document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
        }
    }

    async createCookiesSession4SfdlPicklist(allSalesforceCookies){
        
        allSalesforceCookies.forEach(async (cookie, index) => {
            let isAValidSession = await isSessionInformationValid(cookie);
            if(isAValidSession){
                this.picklistInformation.push({ label: 'https://' + cookie.domain, value:cookie.value });
            }

            if(index === allSalesforceCookies.length - 1) {
                this.setPicklistValues();
            }
        });

        //Send empty picklist values even if there are no sessions stored in cookies
        if(!allSalesforceCookies.length) {
            this.setPicklistValues();    
        }
    }

    setPicklistValues() {
        this.template.querySelector('sfdl-picklist').setPicklistValues(this.picklistInformation);
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
        this.initializeCustomCss();

        setTimeout(() => {
            this.showLogListSection = !this.showLogListSection;
            const logListPanel = this.template.querySelector('.sfdl-console-log-list-section');
            if(event.detail.classAction === 'remove') {
                logListPanel.classList.add('log-list-is-closed');
                setTimeout(() => {
                    logListPanel.classList[event.detail.classAction]('slds-is-open');
                },50);            
            } else {
                logListPanel.classList[event.detail.classAction]('slds-is-open');
                setTimeout(() => {
                    logListPanel.classList.remove('log-list-is-closed');
                },50);    
            }
        },50);
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
            this.toastAction = 'info';
            this.toastHeader = 'Not available';
            this.toastMessage = 'We are working on new features. Available soon! (:';
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