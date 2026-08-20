/*global chrome*/
import { LightningElement, api } from 'lwc';
import { manipulationDetailLogs } from 'sfdl/logDetailsManipulation';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { showToastEvent } from 'sfdl/utils';

const ZIP_FOLDER_NAME = 'Salesforce Debug Logs';
const ZIP_FILE_NAME = 'sfdl-ApexLog.zip';
const DOWNLOAD_CANCELLED = 'sfdl: Download cancelled!';

export default class DownloadLogs extends LightningElement{
    @api logList;
    @api manipulationOptions;
    @api sessionInformation;
    logsDownloaded = 0;
    cancel = false;

    connectedCallback(){
        this.startDownloadProcess();
    }

    async startDownloadProcess(){
        try{
            if(this.isSingleLogDownload()){
                await this.downloadSingleLog();
            } else {
                await this.downloadLogsAsZipFile();
            }
        } catch(error){
            this.sendDownloadProcessCompletedAlert();

            if(error.message !== DOWNLOAD_CANCELLED){
                showToastEvent('error', 'sfdl', 'The download could not be completed: ' + error.message);
            }

            return;
        }

        this.sendDownloadProcessCompletedAlert();

        showToastEvent('success', 'sfdl', this.downloadCompletedMessage());
    }

    isSingleLogDownload(){
        return this.logList && this.logList.length === 1;
    }

    downloadCompletedMessage(){
        return this.isSingleLogDownload() ?
            'Log downloaded, validate in your local directory.' :
            'Logs download, validate in your local directory.';
    }

    async downloadSingleLog(){
        const apexLog = this.logList[0];
        const logDetail = await this.getApexLogDetail(apexLog);

        this.updateLogsDownloaded();
        this.saveDebugLogFile(logDetail, this.createLogFileName(apexLog));
    }

    async downloadLogsAsZipFile(){
        let zip = new JSZip();

        let debugLogsZipFolder = this.createZipFolder(zip);
        await this.addDebugLogsToZipFolder(debugLogsZipFolder);

        let content = await debugLogsZipFolder.generateAsync({type:"blob"});

        this.saveDebugLogsZipFile(content);
    }

    createZipFolder(zip){
        return zip.folder(ZIP_FOLDER_NAME);
    }

    async addDebugLogsToZipFolder(debugLogsZipFolder){
        for (const apexLog of this.logList) {
            if(this.cancel) {
                this.cancel = false;
                throw new Error(DOWNLOAD_CANCELLED);
            }

            let logDetail = await this.getApexLogDetail(apexLog);

            this.updateLogsDownloaded();

            debugLogsZipFolder.file(this.createZipEntryName(apexLog), Promise.resolve(logDetail));
        }
    }

    async getApexLogDetail(apexLog){
        let logDetailFromPromise = apexLog.response;

        if(!logDetailFromPromise) {
            let message = await chrome.runtime.sendMessage({
                message: "downloadApexLog", 
                sessionInformation: this.sessionInformation, apexLog
            });

            logDetailFromPromise = message.apexLogWithBody.response.response;
        }

        return manipulationDetailLogs(await logDetailFromPromise, this.manipulationOptions);
    }

    @api
    updateLogsDownloaded() {
        this.logsDownloaded++;
        this.dispatchEvent(new CustomEvent('downloadprogress',{
            detail:{
                logsDownloaded: this.logsDownloaded
            }
        }));
    }

    createLogFileName(log){
        return log.name
            .replaceAll('/','-')
            .replaceAll('<','')
            .replaceAll('>','')
            .replaceAll('|','') + 
            ' - ' + log.id + '.log';
    }

    createZipEntryName(log){
        return 'sfdl/' + this.createLogFileName(log);
    }

    saveDebugLogFile(logDetail, fileName){
        saveAs(new Blob([logDetail], {type:'text/plain;charset=utf-8'}), fileName);
    }

    saveDebugLogsZipFile(content){
        saveAs(content, ZIP_FILE_NAME);
    }

    sendDownloadProcessCompletedAlert(){
        this.dispatchEvent(new CustomEvent('downloadprocesscompleted',{
            detail:{}
        }));
    }

    @api
    cancelDownload() {
        this.cancel = true;
    }
}
