import { LightningElement, api } from 'lwc';
import * as JSZip from 'jszip';
import { saveAs } from 'file-saver';

export default class DownloadLogs extends LightningElement{
    @api logList;
    cancelDownload = {};

    connectedCallback(){
        this.startDownloadProcess();
    }

    @api
    handleCancelDownload(cancelDownload){
        console.log('Cancel')
        this.sendToastMessage2LogList('warning', 'sfdl', 'Download debug logs process cancelled.')
        this.cancelDownload = cancelDownload;
    }

    async startDownloadProcess(){
        let zip = new JSZip();

        let debugLogsZipFolder = this.createZipFolder(zip);
        this.addDebugLogsToZipFolder(debugLogsZipFolder);
        let executionTimeBeforeProcessingGenerateAsync = Date.now();

        console.log('processing...');
        let content = await debugLogsZipFolder.generateAsync({type:"blob"});
        
        if(this.cancelDownloadProcess(executionTimeBeforeProcessingGenerateAsync)){
            return;
        }

        this.saveDebugLogsZipFile(content);
        this.sendToastMessage2LogList('success', 'sfdl', 'Logs download, validate in your local directory.');
        this.sendDownloadProcessCompletedAlert();
    }

    cancelDownloadProcess(executionTimeBeforeProcessingGenerateAsync){
        return this.cancelDownload && executionTimeBeforeProcessingGenerateAsync < this.cancelDownload.abortTime;
    }

    createZipFolder(zip){
        return zip.folder("Salesforce Debug Logs");
    }

    addDebugLogsToZipFolder(debugLogsZipFolder){
        this.logList.forEach(log => {
            debugLogsZipFolder.file(log.name, log.response) 
        });
    }

    saveDebugLogsZipFile(content){
        saveAs(content, "sfdl-ApexLog.zip");
    }

    sendDownloadProcessCompletedAlert(){
        this.dispatchEvent(new CustomEvent('downloadprocesscompleted',{
            detail:{}
        }));
    }

    sendToastMessage2LogList(action, header, message){
        this.dispatchEvent(new CustomEvent('toastmessage',{
            detail:{
                action, header, message
            }
        }))
    }
}