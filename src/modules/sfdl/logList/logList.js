/*global chrome*/
import { track, api, LightningElement  } from 'lwc';
import { showToastEvent, confirmDialog, alertDialog } from 'sfdl/utils';
import { deleteRecords, isPermissionError, isPermissionOutcome } from 'sfdl/salesforceConnection';
import { adoptStyleSheet } from 'sfdl/styleSheets';
import { css } from './logListCss';

const APEX_LOG_IDS_QUERY_URL = '/services/data/v51.0/tooling/query/?q=';
const APEX_LOG_IDS_QUERY_URL_SELECT_FROM = 'SELECT Id, LastModifiedDate, LogLength, LogUser.Name, Operation, Status FROM ApexLog ';
const APEX_LOG_IDS_QUERY_URL_ORDER_BY = ' ORDER BY LastModifiedDate DESC';
const KEYBOARD_ARROW_UP_CODE = 38;
const KEYBOARD_ARROW_DOWN_CODE = 40;
//The slds utility icons are white shapes, only readable on a filled button.
//This one is the same glyph in the #0176d3 the rest of the buttons use.
const DOWNLOAD_ICON = '/resources/downloadBlue.svg';
const DELETE_ICON = '/resources/deleteBlue.svg';
const CLOSE_ICON = '/slds/icons/utility/close.svg';

function pluralLogs(count){
    return count + (count === 1 ? ' log' : ' logs');
}

const processResponseBasedOnContentType = {
    httpError(response){
        return {hasError: true, error: response.error, message: response.message};
    },
    async contentTypeJson(response){
        const logsInformation = await response.json()
        return logsInformation.records.map(logRecord => logRecord);
    },
    async contentTypeText(response, logId, fileName){
        let newResponse = response.clone();
        let blob = new Blob([newResponse.text()], {
            type: 'text/html'
        });
        console.log('blobsize: ' + blob.size); 
        return {id:logId, name:fileName, response:response.text()};
    }
}

export default class LogList extends LightningElement{
    @api sessionInformation;
    @api isAnaliseLogs = false;

    @track logList = [];
    
    thereAreLogsToDisplay = false;
    //The query came back without a log, as opposed to not having run yet.
    isListEmpty = false;
    isLoading = false;
    isDownloading;
    isDeleting = false;
    totalLogsToDelete = 0;
    firstRender = true;

    closeIcon = CLOSE_ICON;
    downloadIcon = DOWNLOAD_ICON;
    deleteIcon = DELETE_ICON;

    @track logs2Download = [];
    downloadButtonDisabled = false;

    totalLogsToDownload = 0;

    index4NavigationFocusOn;

    get selectedLogs(){
        return this.logList.filter(log => log.isSelected);
    }

    get selectedLogsCount(){
        return this.selectedLogs.length;
    }

    get areAllLogsSelected(){
        return this.logList.length > 0 && this.selectedLogsCount === this.logList.length;
    }

    get thereAreSelectedLogs(){
        return this.selectedLogsCount > 0;
    }

    get areTwoLogsSelected(){
        return this.selectedLogsCount === 2;
    }

    get isPartialSelection(){
        return this.thereAreSelectedLogs && !this.areAllLogsSelected;
    }

    get downloadLabel(){
        return this.thereAreSelectedLogs ?
            'Download selected logs (' + this.selectedLogsCount + ')' :
            'Download all logs';
    }

    get downloadButtonTitle(){
        return this.thereAreSelectedLogs ? 'Download the selected logs' : 'Download all logs';
    }

    get deleteLabel(){
        return this.thereAreSelectedLogs ?
            'Delete selected logs (' + this.selectedLogsCount + ')' :
            'Delete all logs';
    }

    get deleteButtonTitle(){
        return this.thereAreSelectedLogs ? 'Delete the selected logs' : 'Delete every log listed';
    }

    //A download or a deletion on the way: the actions wait for it.
    get isBusy(){
        return this.isDownloading || this.isDeleting;
    }

    get selectAllTitle(){
        return this.areAllLogsSelected ? 'Unselect every log' : 'Select all logs';
    }

    //A where clause can leave out every log of an org that has some.
    get emptyMessage(){
        if(!this.isListEmpty || this.isBusy){
            return '';
        }

        return this.sessionInformation && this.sessionInformation.queryWhere ?
            'No logs match the query filter' :
            'There are no logs in this org';
    }

    connectedCallback(){
        if(this.isAnaliseLogs){
            this.getApexLogsInformation(this.sessionInformation);
        }
    }

    renderedCallback() {
        this.initializeCustomCss();
        this.syncSelectAllCheckbox();
    }

    //indeterminate is a dom property with no template binding, and the checked
    //state can go stale when the selection is cleared while it is unchecked.
    syncSelectAllCheckbox(){
        const selectAllCheckbox = this.template.querySelector('.selectAllLogsCheckbox');

        if(selectAllCheckbox){
            selectAllCheckbox.checked = this.areAllLogsSelected;
            selectAllCheckbox.indeterminate = this.isPartialSelection;
        }
    }
    
    initializeCustomCss() {
        adoptStyleSheet(css);
    }

    showAllLogs() {
        this.template.querySelectorAll('.slds-item').forEach(element => {
            console.log('here');
            element.classList.remove('custom-animation');
        });
    }

    handleLogInfo(event){
        if(this.isAnaliseLogs){
            this.logInfoAnalyseLogs(event);
        }
    }

    async logInfoAnalyseLogs(event){
        // event.target is no longer readable once this handler awaits, so the
        // log information is read upfront.
        const logId = event.target.dataset.logid;
        const logName = event.target.dataset.logname;

        this.logDetailProcessing();
        this.setIndexFocusFromOnClickLogSelection(event);
        this.removeboxShadowForAllTheLogDetails();
        this.boxShadowForTheLogDetailSelected(event, '0 0 0 3px #006bff40');

        let logDetails = this.getLogByIdFromLogList(logId);

        if(!logDetails.response) {
            await this.processApexLog(this.sessionInformation, logDetails);
        }

        this.dispatchEvent(new CustomEvent('logdetails',{
            detail: { 
                logName,
                logDetails: logDetails
            }
        }))
    }

    logDetailProcessing(){
        this.dispatchEvent(new CustomEvent('isloading',{
            detail: {}
        }))
    }

    getLogByIdFromLogList(logId){
        return this.logList.find(log => log.id === logId);
    }

    //The log name button is only one cell of the row, so the highlight belongs
    //to the row that holds it, the checkbox and the download icon.
    getLogRowFromLogButton(logButton){
        return logButton && logButton.closest ? logButton.closest('.sfdl-log-row') : null;
    }

    boxShadowForTheLogDetailSelected(event, color){
        const logRow = this.getLogRowFromLogButton(event.target);

        if(logRow){
            logRow.style.boxShadow = color;
            logRow.style.outline = color === 'none' ? 'none' : '-webkit-focus-ring-color auto 1px';
        }

        event.target.focus();
    }
    removeboxShadowForAllTheLogDetails(){
        this.template.querySelectorAll('.sfdl-log-row').forEach(element => {
            element.style.boxShadow = 'none';
            element.style.outline = 'none';

        });
    }

    async getApexLogsInformation(sessionInformation) {
        this.isLoading = true;
        try{
            await this.queryApexLogs(sessionInformation);
        } finally {
            this.isLoading = false;
        }
    }

    async queryApexLogs(sessionInformation) {
        let url2GetApexLogIds = sessionInformation.instanceUrl +
            APEX_LOG_IDS_QUERY_URL + APEX_LOG_IDS_QUERY_URL_SELECT_FROM +
            (sessionInformation.queryWhere ? sessionInformation.queryWhere : APEX_LOG_IDS_QUERY_URL_ORDER_BY);
        const apexLogList = await this.getInformationFromSalesforce(url2GetApexLogIds, {}, sessionInformation, 'contentTypeJson');

        if(apexLogList.response.hasError){
            this.enableSearchQueryIcon();
            showToastEvent('error', apexLogList.response.error, apexLogList.response.message);
            return;
        }

        this.isListEmpty = !apexLogList.response.length;

        if(apexLogList.response.length){
            this.thereAreLogsToDisplay = true;
            let logResponse = await this.getApexLogList(apexLogList.response);
            this.logList = this.addSelectionFlag2LogList(logResponse.apexLogList);
            this.disableDownloadButton(false)
            showToastEvent('success', 'Let\'s start the analysis (:', sessionInformation.instanceUrl);
            setTimeout(() => {
                this.showAllLogs();
            }, 500);
        } else {
            this.thereAreLogsToDisplay = false;
            showToastEvent('info', 'There are no logs to retrieve', sessionInformation.instanceUrl);
        }

        this.enableSearchQueryIcon();
    }

    getApexLogList(apexLogList) {
        return chrome.runtime.sendMessage({
            message: "getApexLogList", apexLogList
        });
    }

    enableSearchQueryIcon(){
         this.dispatchEvent(new CustomEvent('enablepicklistbuttons',{
            detail:{}
        }))
    }


    async getInformationFromSalesforce(requestUrl, additionalOutputs, sessionInformation, function2Execute, logId) {
            const response = await this.fetchLogsRecords(requestUrl,sessionInformation, function2Execute, logId, additionalOutputs.fileName);
            return {response, additionalOutputs};
    }

    async fetchLogsRecords(requestUrl, sessionInformation, function2Execute, logId, fileName){
        let response = {}; 
        try{
            response = await fetch(requestUrl,{
                method:'GET',
                headers: {
                    'Authorization': 'Bearer ' + sessionInformation.authToken,
                    'Content-type': 'application/json; charset=UTF-8; text/plain',
                }
            });

            if(response.status === 400) {
                function2Execute = 'httpError';
                response.error = 'Invalid query :('; 
                response.message = requestUrl.split('q=')[1];
            } else if (response.status === 401) {
                function2Execute = 'httpError';
                response.error = 'Invalid session :('; 
                response.message = sessionInformation.instanceUrl;
                response.message = response.status === 401 ? response.statusText + ': Invalid session' : response.message;
            } else if (response.status !== 200) {
                function2Execute = 'httpError';
                response.error = 'Error :('; 
                response.message = response.statusText;
            }
        } catch(e){}

        return processResponseBasedOnContentType[function2Execute](response, logId, fileName);
    }

    async processApexLog(sessionInformation, apexLog) {
        let message = await chrome.runtime.sendMessage({
            message: "downloadApexLog", 
            sessionInformation, apexLog
        });

        let apexLog2Update = this.logList.find( log => log.id === message.apexLogWithBody.response.id);

        apexLog2Update.response = message.apexLogWithBody.response.response;
    }

    addSelectionFlag2LogList(apexLogList){
        return (apexLogList ? apexLogList : []).map(apexLog => {
            return { ...apexLog, isSelected: false };
        });
    }

    handleLogSelection(event){
        const log2Select = this.getLogByIdFromLogList(event.currentTarget.dataset.logid);

        if(log2Select){
            log2Select.isSelected = event.currentTarget.checked;
        }
    }

    handleSelectAllLogs(event){
        this.selectEveryLog(event.currentTarget.checked);
    }

    handleClearSelection(){
        this.selectEveryLog(false);
    }

    selectEveryLog(isSelected){
        this.logList.forEach(log => { log.isSelected = isSelected; });
    }

    handleDownloadLogs(){
        //Nothing ticked means the whole list, the way it behaved before the
        //checkboxes were introduced.
        this.startDownloadProcess(this.thereAreSelectedLogs ? this.selectedLogs : this.logList);
    }

    //The log further down the list goes on the left, the older one when the
    //logs are listed newest first.
    handleCompareSelected(){
        const [newer, older] = this.selectedLogs;

        this.dispatchEvent(new CustomEvent('comparelogs', {
            detail: { logs: [older, newer] }
        }));
    }

    handleDownloadSingleLog(event){
        const log2Download = this.getLogByIdFromLogList(event.currentTarget.dataset.logid);

        if(log2Download){
            this.startDownloadProcess([log2Download]);
        }
    }

    startDownloadProcess(logs2Download){
        if(this.isDownloading){
            showToastEvent('info', 'sfdl', 'There is a download in progress, wait for it to finish.');
            return;
        }
        if(this.isDeleting){
            showToastEvent('info', 'sfdl', 'There is a deletion in progress, wait for it to finish.');
            return;
        }

        this.logs2Download = logs2Download;
        this.totalLogsToDownload = logs2Download.length;
        this.isDownloading = true;
    }

    handleDownloadProcessCompleted(){
        this.isDownloading = false;
        this.logs2Download = [];
    }

    //The trash of a row deletes at once, a mistake there costs one log.
    handleDeleteSingleLog(event){
        const log2Delete = this.getLogByIdFromLogList(event.currentTarget.dataset.logid);

        if(log2Delete){
            this.deleteLogs([log2Delete]);
        }
    }

    //Nothing ticked means the whole list, as the download reads it. Either way
    //it asks first: there is no recycle bin for a debug log.
    async handleDeleteLogs(){
        const logs2Delete = this.thereAreSelectedLogs ? this.selectedLogs : this.logList;
        const count = logs2Delete.length;
        const confirmed = await confirmDialog({
            title: this.thereAreSelectedLogs ? 'Delete the selected logs?' : 'Delete all the logs listed?',
            message: pluralLogs(count) + ' of ' + this.sessionInformation.instanceUrl +
                ' will be deleted for good. Salesforce keeps no copy of a deleted debug log.',
            confirmLabel: 'Delete ' + pluralLogs(count)
        });

        if(confirmed){
            await this.deleteLogs(logs2Delete);
        }
    }

    async deleteLogs(logs2Delete){
        if(this.isDownloading){
            showToastEvent('info', 'sfdl', 'There is a download in progress, wait for it to finish.');
            return;
        }
        if(this.isDeleting){
            showToastEvent('info', 'sfdl', 'There is a deletion in progress, wait for it to finish.');
            return;
        }

        this.isDeleting = true;
        this.totalLogsToDelete = logs2Delete.length;

        try{
            const outcome = await deleteRecords(this.sessionInformation, logs2Delete.map(log => log.id), {
                onProgress: settled => this.updateDeleteProgress(settled)
            });
            this.removeLogsFromList(outcome.deleted);
            this.reportDeletion(outcome);
        } catch(error){
            if(isPermissionError(error)){
                this.alertNoPermissionToDelete();
            } else {
                showToastEvent('error', 'Could not delete the logs', error.message);
            }
        } finally {
            this.isDeleting = false;
        }
    }

    updateDeleteProgress(settled){
        const processBar = this.template.querySelector('.sfdl-delete-process-bar');

        if(processBar){
            processBar.updateProgressBar(settled);
        }
    }

    removeLogsFromList(deletedIds){
        if(!deletedIds.length){
            return;
        }

        const deleted = new Set(deletedIds);
        this.logList = this.logList.filter(log => !deleted.has(log.id));

        if(!this.logList.length){
            this.thereAreLogsToDisplay = false;
            this.isListEmpty = true;
        }

        this.dispatchEvent(new CustomEvent('logsdeleted', {
            detail: { ids: deletedIds }
        }));
    }

    reportDeletion(outcome){
        if(isPermissionOutcome(outcome)){
            this.alertNoPermissionToDelete();
            return;
        }

        if(outcome.failed.length){
            showToastEvent('error',
                pluralLogs(outcome.failed.length) + ' could not be deleted',
                outcome.failed[0].message + (outcome.deleted.length ? ' The other ' + pluralLogs(outcome.deleted.length) + ' went.' : ''));
            return;
        }

        showToastEvent('success',
            outcome.deleted.length === 1 ? 'Log deleted' : pluralLogs(outcome.deleted.length) + ' deleted',
            this.sessionInformation.instanceUrl);
    }

    alertNoPermissionToDelete(){
        alertDialog({
            title: 'You can\'t delete logs here',
            message: 'Your user has no permission to delete the debug logs of ' + this.sessionInformation.instanceUrl +
                '. Deleting a log takes the Modify All Data permission, ask an administrator for it.'
        });
    }

    disableDownloadButton(isDisable){
        this.downloadButtonDisabled = isDisable;
    }

    @api
    handleManipulationOptionsForDownloading(manipulationOptions){
        this.manipulationOptions = manipulationOptions;
    }

    handleDownloadProgress(event) {
        const sfdlProcessBar = this.template.querySelector('sfdl-process-bar');

        if(sfdlProcessBar){
            this.template.querySelector('sfdl-process-bar').updateProgressBar(event.detail.logsDownloaded);
        }
    }

    onKeyArrowsPressed(event){
        this.preventDefault(event);
        if(event.keyCode === 38 || event.keyCode === 40){
            this.logListNavigation(event);
        }
    }

    logListNavigation(event){    
        let keyUp = event.keyCode === KEYBOARD_ARROW_UP_CODE;
        let keyDown = event.keyCode === KEYBOARD_ARROW_DOWN_CODE;
        
        let itemSelected = this.template.querySelectorAll('.logList');

        if(this.index4NavigationFocusOn === 0 && keyUp){
            this.index4NavigationFocusOn = itemSelected.length - 1;
        } else if(this.index4NavigationFocusOn === itemSelected.length - 1 && keyDown){
            this.index4NavigationFocusOn = 0;
        } else {
            this.index4NavigationFocusOn = keyUp ? this.index4NavigationFocusOn - 1  : this.index4NavigationFocusOn + 1;
        }

        let eventObject = {
            target:itemSelected[this.index4NavigationFocusOn]
        }

        this.logInfoAnalyseLogs(eventObject); 
    }

    preventDefault(event){
        event.preventDefault();
    }

    setIndexFocusFromOnClickLogSelection(event){
        let logList = this.template.querySelectorAll('.logList');
        for(const index in logList){
            if(logList[index].dataset.logid === event.target.dataset.logid){
                this.index4NavigationFocusOn = Number(index);
                return;
            }
        }
    }

    cancelDownload() {
        this.template.querySelector('sfdl-download-logs').cancelDownload();
        this.handleDownloadProcessCompleted();
        showToastEvent('warning', 'sfdl', 'Download cancelled!');
    }
}