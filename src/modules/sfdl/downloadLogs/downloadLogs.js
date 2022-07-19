import { LightningElement, api } from 'lwc';
import { manipulationDetailLogs } from 'sfdl/logDetailsManipulation';
import * as JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { showToastEvent } from 'sfdl/utils';

export default class DownloadLogs extends LightningElement{
    @api logList;
    @api manipulationOptions;

    connectedCallback(){
        console.log('List: ' , this.logList);
        this.startDownloadProcess();
    }

    async startDownloadProcess(){
        let zip = new JSZip();

        let debugLogsZipFolder = this.createZipFolder(zip);
        await this.addDebugLogsToZipFolder(debugLogsZipFolder);

        let content = await debugLogsZipFolder.generateAsync({type:"blob"});


        this.saveDebugLogsZipFile(content);
        this.sendToastMessage2LogList('success', 'sfdl', 'Logs download, validate in your local directory.');
        this.sendDownloadProcessCompletedAlert();
    }

    createZipFolder(zip){
        return zip.folder("Salesforce Debug Logs");
    }

    async addDebugLogsToZipFolder(debugLogsZipFolder){
        this.logList.forEach(async log => {
            let logDetailFromPromise = await log.response;
            let logDetail =  manipulationDetailLogs(logDetailFromPromise, this.manipulationOptions);
            debugLogsZipFolder.file(this.createLogFileName(log), Promise.resolve(logDetail));
        });
    }

    createLogFileName(log){
        return log.name.replaceAll('/','-') + ' | ' + log.id + '.log';
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
        showToastEvent(action,header,message);
/*         this.dispatchEvent(new CustomEvent('toastmessage',{
            detail:{
                action, header, message
            }
        })) */
    }
}