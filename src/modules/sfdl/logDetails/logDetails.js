import { LightningElement,api } from 'lwc';
import { manipulationDetailLogs } from 'sfdl/logDetailsManipulation';
import { monacoThemes, tokenizerRoot } from 'util/monacoThemes';
import * as monaco from 'monaco-editor';

const TOGGLE_IMAGE_RIGHT = '/slds/icons/utility/toggle_panel_right.svg';
const TOGGLE_IMAGE_LEFT = '/slds/icons/utility/toggle_panel_left.svg';

export default class LogDetails extends LightningElement{
    @api showLogListSection;
    logName = '';
    logDetails;
    showMonacoEditor;
    toggleImage = TOGGLE_IMAGE_RIGHT;

    formatMethodEntryExitHierarchy = false;
    heapStatementRemoveLines = false;

    manipulationOptions = [
        {
            label: 'Method Entry/Exit hierarchy format',
            name: 'methodEntryExitCodeUnitStartedFinished2Hierarchy',
            checked: false
        },
        {
            label: 'Remove HEAP_ALLOCATE / STATEMENT_EXECUTE',
            name: 'removeHeapAllocateAndStatementExecute',
            checked:false
        }
    ];

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
    async displayLogsDetailsFromLogList(logDetails, logName){
        this.logDetails = logDetails;
        let formatLogDetails = await manipulationDetailLogs(logDetails, this.manipulationOptions);
        await this.renderedMonacoEditor();
        if(this.template.querySelector('.sfdlMonacoEditor')){
            this.logName = logName;
            monaco.editor.create(this.template.querySelector('.sfdlMonacoEditor'), {
                value: formatLogDetails,
                automaticLayout: true,
                language: 'apexlog',
                theme: 'customDawn'
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

    handleManipulationOptions(event){
        this.manipulationOptions.forEach((option) => {
            if(option.name === event.detail.function2Execute){
                option.checked = event.detail.checked;
            }
        });

        this.sendManipulationOptionsToConsole();
        this.renderLogDetailsAfterManipulationOptionSelection();
    }

    sendManipulationOptionsToConsole(){
        this.dispatchEvent(new CustomEvent('manipulationoptions',{
            detail: { manipulationOptions: this.manipulationOptions }
        }));
    }

    renderLogDetailsAfterManipulationOptionSelection(){
        if(this.logDetails){
            this.displayLogsDetailsFromLogList(this.logDetails, this.logName);
        }
    }
}