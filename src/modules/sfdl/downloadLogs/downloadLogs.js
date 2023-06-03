/*global chrome*/
import { LightningElement, api } from 'lwc';
import { manipulationDetailLogs } from 'sfdl/logDetailsManipulation';
import * as JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { showToastEvent } from 'sfdl/utils';

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
        let zip = new JSZip();

        let debugLogsZipFolder = this.createZipFolder(zip);
        await this.addDebugLogsToZipFolder(debugLogsZipFolder);

        let content = await debugLogsZipFolder.generateAsync({type:"blob"});


        this.saveDebugLogsZipFile(content);
        this.sendDownloadProcessCompletedAlert();

        showToastEvent('success', 'sfdl', 'Logs download, validate in your local directory.');

    }

    createZipFolder(zip){
        return zip.folder("Salesforce Debug Logs");
    }

    async addDebugLogsToZipFolder(debugLogsZipFolder){
        for (const apexLog of this.logList) {
            if(this.cancel) {
                this.cancel = false;
                throw new Error('sfdl: Download called! :(');
            }

            let message;

            if(!apexLog.response) {
                message = await chrome.runtime.sendMessage({
                    message: "downloadApexLog", 
                    sessionInformation: this.sessionInformation, apexLog
                });
            }

            this.updateLogsDownloaded();

            let logDetailFromPromise = apexLog.response ? apexLog.response : message.apexLogWithBody.response.response;

            let logDetail =  manipulationDetailLogs(logDetailFromPromise, this.manipulationOptions);

            debugLogsZipFolder.file(this.createLogFileName(apexLog), Promise.resolve(logDetail));
        }
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
        return 'sfdl/' + log.name
            .replaceAll('/','-')
            .replaceAll('<','')
            .replaceAll('>','')
            .replaceAll('|','') + 
            ' - ' + log.id + '.log';
    }

    saveDebugLogsZipFile(content){
        saveAs(content, "sfdl-ApexLog.zip");
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