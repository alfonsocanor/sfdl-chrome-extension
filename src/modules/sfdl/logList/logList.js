import { track, api, LightningElement  } from 'lwc';

const apexLogIdsQueryUrl = '/services/data/v51.0/tooling/query/?q=SELECT Id, LastModifiedDate, LogLength, LogUser.Name, Operation FROM ApexLog ';
const KB2MB = 0.00000095367432;

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

    @track logList = [];
    thereAreLogsToDisplay = true;
    isDownloading;
    @track abortDownload;
    firstRender = true;

    connectedCallback(){
        this.getApexLogsInformation(this.sessionInformation);
    }

    renderedCallback(){
        if(this.firstRender){
            this.disableDownloadButton(true);
            this.firstRender = false;
        }
    }

    async handleLogInfo(event){
        const response = this.logList.filter(log => {
            return log.id === event.target.dataset.logid
        });

        const logDetails = await response[0].response;
        const logName = event.target.dataset.logname;

        this.dispatchEvent(new CustomEvent('logdetails',{
            detail: { logDetails, logName }
        }))
    }

    async getApexLogsInformation(sessionInformation) {
        let url2GetApexLogIds = sessionInformation.instanceUrl + apexLogIdsQueryUrl;
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
        apexLogList.forEach(async apexLog => {
            let completeUrl = sessionInformation.instanceUrl + apexLog.attributes.url + '/Body';

            //Some operation values contains '/' char
            let regex = new RegExp('/', 'g');

            let fileName =
                (apexLog.LogLength * KB2MB).toFixed(4) + 'MB | ' +
                apexLog.Operation.replace(regex, '') + ' | ' +
                apexLog.LastModifiedDate.split('.')[0] + ' | ' +
                apexLog.LogUser.Name + ' | ' +
                apexLog.Id + '.log';

            let logInformation = await this.getInformationFromSalesforce(completeUrl, { fileName }, sessionInformation, 'contentTypeText', apexLog.Id)

            this.logList.push(logInformation.response);
            if(this.logList.length === apexLogList.length){
                this.disableDownloadButton(false);
            }
        });
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
}
