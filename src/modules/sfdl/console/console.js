import { LightningElement, track } from 'lwc';
import { getAllCookiesFromSalesforceDomain, isSessionInformationValid } from 'sfdl/authentication';
import { adoptStyleSheet } from 'sfdl/styleSheets';
import { css } from './consoleCss';

const DEBUG_LOGS_TAB = 'debugLogs';
const COMPARE_METADATA_TAB = 'compareMetadata';
const ANALYSE_MODE = 'analyse';
const COMPARE_MODE = 'compare';
const SAME_ORG_SCOPE = 'sameOrg';
const TWO_ORGS_SCOPE = 'twoOrgs';
const TAB_ITEM_CLASS = 'slds-tabs_scoped__item';
const TAB_CONTENT_CLASS = 'slds-tabs_scoped__content';
const BUTTON_CLASS = 'slds-button';

export default class Console extends LightningElement {
    firstRender = true;
    renderLogList = false;
    
    manipulationOptions;

    activeTab = DEBUG_LOGS_TAB;
    logsMode = ANALYSE_MODE;
    compareScope = SAME_ORG_SCOPE;
    compareSameOrgRendered = false;
    compareTwoOrgsRendered = false;
    compareMetadataRendered = false;
    bodyHeight = 0;
    logsBodyHeight = 0;
    logsToolbarHeight = 0;
    orgs = [];
    //Two logs of the org of the log list ticked to compare them, handed to
    //the comparison of the same org: { left, right } each being
    //{ log, sessionInformation }.
    pairComparison = null;

    sectionStyle = 'background-color:#fafaf9;position:relative;overflow:hidden;display:flex;';

    @track picklistInformation = [];
    @track sessionInformation;

    resetConsoleProperties(){
        this.renderLogList = false;
        this.manipulationOptions = {};
        this.activeTab = DEBUG_LOGS_TAB;
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
        let sfdlFooterContainer = this.template.querySelector('.sfdl-footer-container');
        let tabs = this.template.querySelector('.slds-tabs_scoped__nav');
        let logsToolbar = this.template.querySelector('.sfdl-debug-logs__toolbar');
        let sfdlBodyTab = this.template.querySelector('.sfdl-body-tab');
        var windowHeight = window.innerHeight;

        //The toolbar measures nothing while its tab is hidden, the last height
        //it had stands in for it.
        if(logsToolbar && logsToolbar.clientHeight){
            this.logsToolbarHeight = logsToolbar.clientHeight;
        }

        if(sfdlBodyTab) {
            this.bodyHeight = (windowHeight - sfdlFooterContainer.clientHeight - tabs.clientHeight - 4);
            this.logsBodyHeight = this.bodyHeight - this.logsToolbarHeight;
            sfdlBodyTab.style.height = this.logsBodyHeight + 'px';
            this.template.querySelector('sfdl-log-details').setMonacoEditorHeight(this.logsBodyHeight - 50);
        }
    }

    async init(){
        this.initializeCustomCss();
        const allSalesforceCookies = await getAllCookiesFromSalesforceDomain();
        this.createCookiesSession4SfdlPicklist(allSalesforceCookies);
    }

    initializeCustomCss() {
        adoptStyleSheet(css);
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

    //Two logs ticked in the analyse list are compared where logs of the same
    //org are, the way an editor opens a diff of two files in a view of its
    //own. Analyse keeps the log it shows.
    handleCompareLogs(event){
        const [left, right] = event.detail.logs;

        this.pairComparison = {
            left: { log: left, sessionInformation: this.sessionInformation },
            right: { log: right, sessionInformation: this.sessionInformation }
        };
        this.logsMode = COMPARE_MODE;
        this.compareScope = SAME_ORG_SCOPE;
        this.compareSameOrgRendered = true;
    }

    get debugLogsTabClass(){
        return this.tabClass(DEBUG_LOGS_TAB, 'liElementDebugLogs');
    }

    get compareMetadataTabClass(){
        return this.tabClass(COMPARE_METADATA_TAB, 'liElementCompareMetadata');
    }

    get debugLogsContentClass(){
        return this.tabContentClass(DEBUG_LOGS_TAB, 'sfdl-debug-logs');
    }

    get compareMetadataContentClass(){
        return this.tabContentClass(COMPARE_METADATA_TAB, 'sfdl-compare-metadata');
    }

    get isAnalyseMode(){
        return this.logsMode === ANALYSE_MODE;
    }

    get analyseButtonClass(){
        return BUTTON_CLASS + (this.isAnalyseMode ? ' slds-button_brand' : ' slds-button_neutral');
    }

    get compareButtonClass(){
        return BUTTON_CLASS + (this.isAnalyseMode ? ' slds-button_neutral' : ' slds-button_brand');
    }

    get isAnalysePressed(){
        return this.isAnalyseMode ? 'true' : 'false';
    }

    get isComparePressed(){
        return this.isAnalyseMode ? 'false' : 'true';
    }

    get analyseViewClass(){
        return 'sfdl-debug-logs__analyse' + (this.isAnalyseMode ? '' : ' slds-hide');
    }

    get isSameOrgScope(){
        return this.compareScope === SAME_ORG_SCOPE;
    }

    get sameOrgButtonClass(){
        return BUTTON_CLASS + (this.isSameOrgScope ? ' slds-button_brand' : ' slds-button_neutral');
    }

    get twoOrgsButtonClass(){
        return BUTTON_CLASS + (this.isSameOrgScope ? ' slds-button_neutral' : ' slds-button_brand');
    }

    get isSameOrgPressed(){
        return this.isSameOrgScope ? 'true' : 'false';
    }

    get isTwoOrgsPressed(){
        return this.isSameOrgScope ? 'false' : 'true';
    }

    get compareSameOrgViewClass(){
        return 'sfdl-debug-logs__same-org' + (!this.isAnalyseMode && this.isSameOrgScope ? '' : ' slds-hide');
    }

    get compareTwoOrgsViewClass(){
        return 'sfdl-debug-logs__two-orgs' + (!this.isAnalyseMode && !this.isSameOrgScope ? '' : ' slds-hide');
    }

    get logsHint(){
        if(this.isAnalyseMode){
            return 'Pick an org in the log list, then a log to read it, or tick two logs and compare them side by side.';
        }

        return this.isSameOrgScope ?
            'Tick two logs to compare them. A new tick replaces the last one, the first stays to compare against. The arrows walk the list.' :
            'Pick an org on each side, then click a log on each side to compare them. The arrows walk a list.';
    }

    //Analyse and the comparisons share the tab and each keeps its state while
    //another one is on screen.
    handleLogsModeChange(event){
        this.logsMode = event.currentTarget.dataset.mode;
        this.renderCompareScope();
    }

    handleCompareScopeChange(event){
        this.compareScope = event.currentTarget.dataset.scope;
        this.renderCompareScope();
    }

    renderCompareScope(){
        if(this.logsMode !== COMPARE_MODE){
            return;
        }

        if(this.compareScope === TWO_ORGS_SCOPE){
            this.compareTwoOrgsRendered = true;
        } else {
            this.compareSameOrgRendered = true;
        }
    }

    tabClass(tabName, tabHtmlClass){
        return TAB_ITEM_CLASS + ' ' + tabHtmlClass + (this.activeTab === tabName ? ' slds-is-active' : '');
    }

    tabContentClass(tabName, contentHtmlClass){
        return TAB_CONTENT_CLASS + ' ' + contentHtmlClass + (this.activeTab === tabName ? ' slds-show' : ' slds-hide');
    }

    handleTabNavigation(event){
        const tabName = event.currentTarget.dataset.tabname;

        if(tabName === COMPARE_METADATA_TAB){
            this.compareMetadataRendered = true;
        }

        this.activeTab = tabName;
    }
}