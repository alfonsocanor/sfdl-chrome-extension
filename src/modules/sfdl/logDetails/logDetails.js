import { LightningElement,api } from 'lwc';
import * as monaco from 'monaco-editor';

const TOGGLE_IMAGE_RIGHT = '/slds/icons/utility/toggle_panel_right.svg';
const TOGGLE_IMAGE_LEFT = '/slds/icons/utility/toggle_panel_left.svg';

export default class LogDetails extends LightningElement{
    @api showLogListSection;
    logName = '';
    logDetails;
    showMonacoEditor;
    toggleImage = TOGGLE_IMAGE_RIGHT;

    @api
    async displayLogsDetailsFromLogList(logDetails, logName){
        this.logDetails = logDetails;
        await this.renderedMonacoEditor();
        if(this.template.querySelector('.sfdlMonacoEditor')){
            this.logName = logName;
            monaco.editor.create(this.template.querySelector('.sfdlMonacoEditor'), {
                value: logDetails,
                automaticLayout: true
            });
        }
    }
 
    async renderedMonacoEditor(){
        this.showMonacoEditor = false;
        await new Promise((resolve)=>{setTimeout(resolve, 100);});
        this.showMonacoEditor = true;
        await new Promise((resolve)=>{setTimeout(resolve, 100);});
    }

    handleHideShowSections(){
        this.toggleImage = this.showLogListSection ? TOGGLE_IMAGE_LEFT : TOGGLE_IMAGE_RIGHT ;

        this.dispatchEvent(new CustomEvent('displayloglistsection',{
            detail: { 
                classAction: this.showLogListSection ? 'remove' : 'add'
            }
        }))
    }
}