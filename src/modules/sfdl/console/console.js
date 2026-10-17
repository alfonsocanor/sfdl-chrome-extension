import { LightningElement, track } from 'lwc';
import { getAllCookiesFromSalesforceDomain, isSessionInformationValid } from 'sfdl/authentication';
import { css } from './consoleCss';

const ANALYSE_LOGS_TAB = 'analyseLogs';
const COMPARE_LOGS_TAB = 'compareLogs';
const COMPARE_ORGS_TAB = 'compareOrgs';
const TAB_ITEM_CLASS = 'slds-tabs_scoped__item';
const TAB_CONTENT_CLASS = 'slds-tabs_scoped__content';

export default class Console extends LightningElement {
    firstRender = true;
    showLogListSection = true;
    renderLogList = false;
    
    manipulationOptions;

    activeTab = ANALYSE_LOGS_TAB;
    compareLogsRendered = false;
    compareOrgsRendered = false;
    bodyHeight = 0;
    orgs = [];

    sectionStyle = 'background-color:#fafaf9;position:relative;overflow:hidden;display:flex;';

    @track picklistInformation = [];
    @track sessionInformation;

    resetConsoleProperties(){
        this.showLogListSection = true;
        this.renderLogList = false;
        this.manipulationOptions = {};
        this.activeTab = ANALYSE_LOGS_TAB;
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
            this.bodyHeight = sfdlBodyTabHeight;
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

    //Every cookie is validated at once and the list is published when the last
    //answer is in. Publishing from inside each validation raced: whichever
    //answer came back for the last cookie published the list, even when the
    //others were still on their way.
    async createCookiesSession4SfdlPicklist(allSalesforceCookies){
        const validatedCookies = await Promise.all(allSalesforceCookies.map(async cookie => ({
            cookie,
            isAValidSession: await isSessionInformationValid(cookie)
        })));

        //A domain can hold more than one sid cookie, the first valid one is enough.
        const domains = new Set();
        this.picklistInformation = validatedCookies
            .filter(({ cookie, isAValidSession }) => {
                if(!isAValidSession || domains.has(cookie.domain)){
                    return false;
                }
                domains.add(cookie.domain);
                return true;
            })
            .map(({ cookie }) => ({ label: 'https://' + cookie.domain, value: cookie.value }));

        this.setPicklistValues();
    }

    setPicklistValues() {
        this.orgs = this.picklistInformation;
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

    get analyseLogsTabClass(){
        return this.tabClass(ANALYSE_LOGS_TAB, 'liElementAnalyseLogs');
    }

    get compareLogsTabClass(){
        return this.tabClass(COMPARE_LOGS_TAB, 'liElementCompareLogs');
    }

    get compareOrgsTabClass(){
        return this.tabClass(COMPARE_ORGS_TAB, 'liElementCompareOrgs');
    }

    get analyseLogsContentClass(){
        return this.tabContentClass(ANALYSE_LOGS_TAB, 'sfdl-analise-logs');
    }

    get compareLogsContentClass(){
        return this.tabContentClass(COMPARE_LOGS_TAB, 'sfdl-compare-logs');
    }

    get compareOrgsContentClass(){
        return this.tabContentClass(COMPARE_ORGS_TAB, 'sfdl-compare-orgs');
    }

    tabClass(tabName, tabHtmlClass){
        return TAB_ITEM_CLASS + ' ' + tabHtmlClass + (this.activeTab === tabName ? ' slds-is-active' : '');
    }

    tabContentClass(tabName, contentHtmlClass){
        return TAB_CONTENT_CLASS + ' ' + contentHtmlClass + (this.activeTab === tabName ? ' slds-show' : ' slds-hide');
    }

    handleTabNavigation(event){
        const tabName = event.currentTarget.dataset.tabname;

        if(tabName === COMPARE_LOGS_TAB){
            this.compareLogsRendered = true;
        } else if(tabName === COMPARE_ORGS_TAB){
            this.compareOrgsRendered = true;
        }

        this.activeTab = tabName;
    }
}