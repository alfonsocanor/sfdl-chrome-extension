import { LightningElement,api } from 'lwc';
import { manipulationDetailLogs } from 'sfdl/logDetailsManipulation';
import { monacoThemes, tokenizerRoot } from 'util/monacoThemes';
import * as monaco from 'monaco-editor';

const TOGGLE_IMAGE_RIGHT = '/slds/icons/utility/toggle_panel_right.svg';
const TOGGLE_IMAGE_LEFT = '/slds/icons/utility/toggle_panel_left.svg';

export default class LogDetails extends LightningElement{
    @api showLogListSection;
    @api isAnaliseLogs = false;
    @api isCompareLogs = false;

    logName = '';
    logDetails; 
    logCompareLeft;
    logCompareRight;

    showMonacoEditor;
    toggleImage = TOGGLE_IMAGE_RIGHT;

    formatMethodEntryExitHierarchy = false;
    heapStatementRemoveLines = false;

    isProcessing = false;

    connectedCallback(){
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
        } else if (this.isCompareLogs){
            this.displayCompareLogsDetails(this.logDetails, logName);
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
                theme: 'customDawn'
            });
        }
    }

    async displayCompareLogsDetails(logDetails,logName){
        this.logCompareLeft = logDetails[0];
        this.logCompareRight = logDetails[1]; 

        const sfdlMonacoEditor = this.template.querySelector('.sfdlMonacoEditor');
        const diffEditor = monaco.editor.createDiffEditor(sfdlMonacoEditor);
        diffEditor.setModel({
            original: manipulationDetailLogs(logDetails[0], this.getManipulationOptions()),
            modified: manipulationDetailLogs(logDetails[1], this.getManipulationOptions())
        });
    }
 
    async renderedMonacoEditor(){
        this.showMonacoEditor = false;
        await new Promise((resolve)=>{setTimeout(resolve, 100);});
        this.showMonacoEditor = true;
        await new Promise((resolve)=>{setTimeout(resolve, 100);});
        this.isProcessing = false;
    }

    handleHideShowSections(){
        this.toggleImage = this.showLogListSection ? TOGGLE_IMAGE_LEFT : TOGGLE_IMAGE_RIGHT ;

        this.dispatchEvent(new CustomEvent('displayloglistsection',{
            detail: { 
                classAction: this.showLogListSection ? 'remove' : 'add'
            }
        }))
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
        console.log('@this.logDetails' , this.logDetails);
        if(this.logDetails){
            this.displayAnalyseLogsDetails(this.logDetails, this.logName);
        }
    }

    getManipulationOptions(){
        return this.template.querySelector('sfdl-log-manipulation-menu').currentManipulationOptions();
    }
}