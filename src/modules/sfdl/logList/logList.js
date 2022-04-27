import { track, LightningElement  } from 'lwc';

const apexLogIdsQueryUrl = '/services/data/v51.0/tooling/query/?q=SELECT Id, LastModifiedDate, LogLength, LogUser.Name, Operation FROM ApexLog ';
const KB2MB = 0.00000095367432;

const processResponseBasedOnContentType = {
    async contentTypeJson(response){
        const logsInformation = await response.json()
        return logsInformation.records.map(logRecord => logRecord);
    },
    async contentTypeText(response, logId, fileName){
        let newResponse = response.clone();
        let blob = new Blob([newResponse.text()], {
            type: 'text/html'
        });
        console.log(blob.size);
        return {id:logId, name:fileName, response:response.text()};
    }
}

export default class LogList extends LightningElement{
    @track logList = [];

    connectedCallback(){
        let sessionInformation = {
            authToken: 'Bearer 00D1y0000008m7I!ARwAQFeSsbWyermjBxUXrM9oFneknE904bEA_b8Qy0qi_HNxfwS6Bb1mHQfGEp1YG6RbxJUF9GQxjLzMqHz8vAhcoyRxBJYP',
            instanceUrl: 'https://naturalchemist--sand1.my.salesforce.com',
        };
        this.getApexLogsInformation(sessionInformation);
    }

    async handleLogInfo(event){
        const response = this.logList.filter(log => {
            return log.id === event.target.dataset.logid
        });

        const logDetail = await response[0].response;
        const logName = event.target.dataset.logname;

        this.dispatchEvent(new CustomEvent('logdetail',{
            detail: { logDetail, logName }
        }))
    }

    async getApexLogsInformation(sessionInformation) {
        let url2GetApexLogIds = sessionInformation.instanceUrl + apexLogIdsQueryUrl + sessionInformation.queryWhere;
        const apexLogList = await this.getInformationFromSalesforce(url2GetApexLogIds, {}, sessionInformation, 'contentTypeJson');

       this.processApexLogs(sessionInformation, apexLogList.response); 
    }

    getRecordsFromSalesforce(sessionInformation, query){
        let url2GetApexLogIds = sessionInformation.instanceUrl + '/services/data/v51.0/query/?q=' + query;
        return this.getInformationFromSalesforce(url2GetApexLogIds, {}, sessionInformation);
    }

    async getInformationFromSalesforce(requestUrl, additionalOutputs, sessionInformation, function2Execute, logId) {
            const response = await this.fetchLogsRecords(requestUrl,sessionInformation, function2Execute, logId, additionalOutputs.fileName);
            return {response, additionalOutputs};
    }

    async fetchLogsRecords(requestUrl, sessionInformation, function2Execute, logId, fileName){
        const response = await fetch(requestUrl,{
            method:'GET',
            headers: {
                'Authorization': sessionInformation.authToken,
                'Content-type': 'application/json; charset=UTF-8; text/plain',
            }
        });

        return processResponseBasedOnContentType[function2Execute](response, logId, fileName);
    }

    async processApexLogs(sessionInformation, apexLogList) {
        apexLogList.forEach(async apexLog => {
            let completeUrl = sessionInformation.instanceUrl + apexLog.attributes.url + '/Body';

            if (sessionInformation.debug) {
                console.log('processApexLogs completeUrl: ', completeUrl);
            }

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
        });
    }
}
