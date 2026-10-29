import { LightningElement,api } from 'lwc';
import { manipulationDetailLogs } from 'sfdl/logDetailsManipulation';
import { monacoThemes, tokenizerRoot } from 'util/monacoThemes';
import { adoptStyleSheet } from 'sfdl/styleSheets';
import { css } from './logDetailsCss';
import * as monaco from 'monaco-editor';

export default class LogDetails extends LightningElement{
    @api isAnaliseLogs = false;
    //Whether the log list has an org. Until it has, the filters and the name
    //of the log stay away and the pane asks for one.
    @api orgPicked = false;

    logName = '';
    logDetails; 

    showMonacoEditor;

    formatMethodEntryExitHierarchy = false;
    heapStatementRemoveLines = false;

    isProcessing = false;

    monacoEditorHeight = 'height: 0px';

    connectedCallback(){
        adoptStyleSheet(css);
        this.setMonacoNewLanguage('apexlog')
        this.setMonarchTokensProvider(tokenizerRoot);
        this.defineMonacoTheme('customDawn');
    }

    defineMonacoTheme(monacoThemeName){
        monaco.editor.defineTheme(monacoThemeName, monacoThemes[monacoThemeName]);
    }

    setMonarchTokensProvider(tokenizer){
        monaco.languages.setMonarchTokensProvider('apexlog', tokenizer)
    }

    setMonacoNewLanguage(languageName){
        monaco.languages.register({ id: languageName });
    }

    @api
    hideMonacoEditor(){
        this.showMonacoEditor = false;
        this.logDetails = null;
        this.logName = '';
    }

    @api
    async processLogsFromLogList(logDetails, logName){
        this.showMonacoEditor = false;
        this.isProcessing = true;
        this.logDetails = await logDetails.response;
        if(this.isAnaliseLogs){
            this.displayAnalyseLogsDetails(this.logDetails, logName);
        }
    }

    async displayAnalyseLogsDetails(logDetails,logName){
        let formatLogDetails = await manipulationDetailLogs(logDetails, this.getManipulationOptions());
        await this.renderedMonacoEditor();
        const sfdlMonacoEditor = this.template.querySelector('.sfdlMonacoEditor');
        if(sfdlMonacoEditor){
            this.logName = logName;
            monaco.editor.create(sfdlMonacoEditor, {
                value: formatLogDetails,
                automaticLayout: true,
                language: 'apexlog',
                theme: 'customDawn',
                fontLigatures: ''
            });
        }
    }

    async renderedMonacoEditor(){
        this.showMonacoEditor = false;
        await new Promise((resolve)=>{setTimeout(resolve, 100);});
        this.showMonacoEditor = true;
        await new Promise((resolve)=>{setTimeout(resolve, 100);});
        this.isProcessing = false;
    }

    handleManipulationOptions(event){
        this.sendManipulationOptionsToConsole(event.detail.manipulationOptions);
        this.renderLogDetailsAfterManipulationOptionSelection();
    }

    sendManipulationOptionsToConsole(manipulationOptions){
        this.dispatchEvent(new CustomEvent('manipulationoptions',{
            detail: { manipulationOptions }
        }));
    }

    renderLogDetailsAfterManipulationOptionSelection(){
        if(this.logDetails){
            this.displayAnalyseLogsDetails(this.logDetails, this.logName);
        }
    }

    getManipulationOptions(){
        const menu = this.template.querySelector('sfdl-log-manipulation-menu');
        return menu ? menu.currentManipulationOptions() : [];
    }

    @api
    handleIsLoading(){
        this.isProcessing = true
    }

    @api
    setMonacoEditorHeight(monacoEditorHeight){
        this.monacoEditorHeight = 'height: ' + monacoEditorHeight + 'px';
    }
}