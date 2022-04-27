import { LightningElement,api } from 'lwc';
import * as monaco from 'monaco-editor';

export default class LogDetails extends LightningElement{
    
    logName = '';
    showMonacoEditor;

    @api
    async displayLogsDetailsFromLogList(logDetail){
        console.log('1');
        await this.renderedMonacoEditor();
        console.log('3');
        if(this.template.querySelector('.sfdlMonacoEditor')){
            this.logName = logDetail.logName;
            monaco.editor.create(this.template.querySelector('.sfdlMonacoEditor'), {
                value: logDetail
            });
        }
    }

    async renderedMonacoEditor(){
        console.log('2');
        this.showMonacoEditor = false;
        await new Promise((resolve)=>{setTimeout(resolve, 100);});
        this.showMonacoEditor = true;
        await new Promise((resolve)=>{setTimeout(resolve, 100);});
    }
}