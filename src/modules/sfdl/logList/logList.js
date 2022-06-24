/*global chrome*/
import { track, api, LightningElement  } from 'lwc';

const APEX_LOG_IDS_QUERY_URL = '/services/data/v51.0/tooling/query/?q=SELECT Id, LastModifiedDate, LogLength, LogUser.Name, Operation FROM ApexLog ORDER BY LastModifiedDate ASC';

const processResponseBasedOnContentType = {
    httpError(response){
        return {hasError: true, error: response.message};
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
    @api isCompareLogs = false;
    @api logs2Compare = [];
    totalLogsCompletelyRetrieved = 0;

    @track logList = [];
    
    thereAreLogsToDisplay = true;
    isDownloading;
    firstRender = true;

    compareLogsColumns2LogDetails = {
        column1:{id:'',logName:'', logDetails:''},
        column2:{id:'',logName:'', logDetails:''}
    }

    connectedCallback(){
        if(this.isAnaliseLogs){
            this.getApexLogsInformation(this.sessionInformation);
        } else if(this.isCompareLogs){
            this.logList = this.logs2Compare;
        }
    }

    renderedCallback(){
        if(this.firstRender){
            this.disableDownloadButton(true);
            this.firstRender = false;
        }
    }

    handleLogInfo(event){
        if(this.isAnaliseLogs){
            this.logInfoAnalyseLogs(event);
        } else  if(this.isCompareLogs){
            this.logInfoCompareLogs(event);
        }
    }

    async logInfoAnalyseLogs(event){
        this.removeboxShadowForAllTheLogDetails();
        this.boxShadowForTheLogDetailSelected(event, '0 0 0 3px #006bff40');

        this.dispatchEvent(new CustomEvent('logdetails',{
            detail: { 
                logName: event.target.dataset.logname,
                logDetails: this.getLogByIdFromLogList(event.target.dataset.logid)[0] 
            }
            //detail: { logName: logInfo.logName, logDetails: logInfo.logDetails }
        }))
    }

    getLogByIdFromLogList(logId){
        return this.logList.filter(log => log.id === logId);
    }

    async getLogInformation(event){
        const response = this.logList.filter(log => {
            return log.id === event.target.dataset.logid
        });
        const logDetails = await response[0].response;
        const logName = event.target.dataset.logname;

        return { logDetails, logName }
    }

    logInfoCompareLogs(event){
        let wasUnselected = this.unselectLogs2Compare(event);

        console.log('wasUnselected@ ' + wasUnselected);
        
        if(!wasUnselected){
            this.selectLogs2Compare(event);
        }

        console.log('@COMpare compareLogsColumns2LogDetails: ' , this.compareLogsColumns2LogDetails);
    }

    async selectLogs2Compare(event){
        const logInfo = await this.getLogInformation(event);
        if(this.bothLogs2CompareSelected()){
            this.updateCompareLogsColumns2LogDetails('column1', event.target.dataset.logid, logInfo.logName, logInfo.logDetails);
            this.boxShadowForTheLogDetailSelected(event, '0 0 0 3px #006bff40');
        } else {
            console.log('at else');
            for(const log2Compare in this.compareLogsColumns2LogDetails){
                if(!this.compareLogsColumns2LogDetails[log2Compare].id){
                    console.log('@log2Compare: ' + log2Compare);
                    this.updateCompareLogsColumns2LogDetails(log2Compare, event.target.dataset.logid, logInfo.logName, logInfo.logDetails);
                    this.boxShadowForTheLogDetailSelected(event, '0 0 0 3px #006bff40');
                    break;
                }
            }
        }

    }

    bothLogs2CompareSelected(){
        for(const log2Compare in this.compareLogsColumns2LogDetails){
            if(!this.compareLogsColumns2LogDetails[log2Compare].id){
                return false;
            }
        }
        return true;
    }

    updateCompareLogsColumns2LogDetails(columnNumber, logId, logName, logDetails){
        this.compareLogsColumns2LogDetails[columnNumber].id = logId;
        this.compareLogsColumns2LogDetails[columnNumber].logName = logName;
        this.compareLogsColumns2LogDetails[columnNumber].logDetails = logDetails;
    }

    unselectLogs2Compare(event){
        for(const log2Compare in this.compareLogsColumns2LogDetails){
            if(this.bothLogs2CompareSelected()){
                console.log(this.template.querySelectorAll('.displayLogButton').length);
                this.template.querySelectorAll('.displayLogButton').find(element => element.dataset.logid === this.compareLogsColumns2LogDetails.column2.id).style.boxShadow = 'none';
                this.compareLogsColumns2LogDetails.column2.id = '';
                this.compareLogsColumns2LogDetails.column2.logName = '';
                this.compareLogsColumns2LogDetails.column2.logDetails = '';        
            } else if(this.compareLogsColumns2LogDetails[log2Compare].id === event.target.dataset.logid){
                this.compareLogsColumns2LogDetails[log2Compare].id = '';
                this.compareLogsColumns2LogDetails[log2Compare].logName = '';
                this.compareLogsColumns2LogDetails[log2Compare].logDetails = '';
                this.boxShadowForTheLogDetailSelected(event, 'none');
                return true
            }
        }

        return false;
    }

    boxShadowForTheLogDetailSelected(event, color){
        event.target.style.boxShadow = color;
    }
    removeboxShadowForAllTheLogDetails(){
        this.template.querySelectorAll('.displayLogButton').forEach(element => {
            element.style.boxShadow = 'none';
        });
    }

    async getApexLogsInformation(sessionInformation) {
        let url2GetApexLogIds = sessionInformation.instanceUrl + APEX_LOG_IDS_QUERY_URL;
        const apexLogList = await this.getInformationFromSalesforce(url2GetApexLogIds, {}, sessionInformation, 'contentTypeJson');

        if(apexLogList.response.hasError){
            this.sendToastMessage2Console('error', apexLogList.response.error, sessionInformation.instanceUrl);
            return;
        }

        if(apexLogList.response.length){
            this.thereAreLogsToDisplay = true;
            this.processApexLogs(sessionInformation, apexLogList.response); 
            this.sendToastMessage2Console('success', 'Retrieving logs...', sessionInformation.instanceUrl);
        } else {
            this.thereAreLogsToDisplay = false;
            this.sendToastMessage2Console('info', 'There are no logs to retrieve', sessionInformation.instanceUrl);
        }
    }

    sendToastMessage2Console(action, header, message){
        this.dispatchEvent(new CustomEvent('toastmessage',{
            detail:{
                action, header, message
            }
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

            if(response.status !== 200){
                function2Execute = 'httpError';
                response.message = response.status === 401 ? response.statusText + ': Invalid session' : response.message;
            }
        } catch(e){
            function2Execute = 'httpError';
            response.message = e.message;
        }
        return processResponseBasedOnContentType[function2Execute](response, logId, fileName);
    }

    processApexLogs(sessionInformation, apexLogList) {
        const message = new Promise(resolve =>
            chrome.runtime.sendMessage({
                message: "getApexLogsBody", 
                sessionInformation, apexLogList
            }, resolve));
        
        message.then(response => {
            this.logList = response;
            this.disableDownloadButton(false);
            this.sendLogList2Console(this.logList);
            this.sendToastMessage2Console('success', 'You can use compare now!', 'Compare Logs');
        });
    }

    logName2Display(apexLog){
        return  apexLog.LogUser.Name + ' | ' + 
                this.createOperationFormat(apexLog.Operation) + ' | ' +
                apexLog.LogLength + 'bytes | ' +
                this.createDatetimeFormat(new Date(apexLog.LastModifiedDate));
    }

    createOperationFormat(operation){
        let regex = new RegExp('/', 'g');

        if(operation.includes('__')){
            return operation.replace(regex, '').split('__')[1];
        }

        return operation.replace(regex, '');
    }

    createDatetimeFormat(date){
        return  this.padNumberValues(date.getDay(), 2,'0') + '/' +
                this.padNumberValues(date.getMonth(), 2, '0') + ' ' +
                this.padNumberValues(date.getHours(), 2, '0') + 'h' + 
                this.padNumberValues(date.getMinutes(), 2, '0') + 'm' +
                this.padNumberValues(date.getSeconds(), 2, '0') + 's';
    }

    padNumberValues(numberValue, padLength, padString){
        return numberValue.toString().padStart(padLength, padString);
    }

    handleOpenCloseSfdlDownload(){
        this.isDownloading = !this.isDownloading;
    }


    handleToastMessage(event){
        this.sendToastMessage2Console(event.detail.action, event.detail.header, event.detail.message);
    }

    disableDownloadButton(isDisable){
        this.template.querySelector('.downloadLogsButton').disabled = isDisable;
    }

    @api
    handleManipulationOptionsForDownloading(manipulationOptions){
        this.manipulationOptions = manipulationOptions;
    }

    downloadinprogress2compare(){
        this.dispatchEvent(new CustomEvent('downloadinprogress2compare',{
            detail: true
        }));
    }

    sendLogList2Console(logList){
        this.dispatchEvent(new CustomEvent('sendloglist',{
            detail:{ logList }
        }));
    }
}