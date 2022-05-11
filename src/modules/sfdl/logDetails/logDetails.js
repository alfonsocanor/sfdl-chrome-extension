import { LightningElement,api } from 'lwc';
import { invokeFilterFormatFunctions } from 'sfdl/logDetailsManipulation';
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

    checkboxOptions = [
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

    @api
    hideMonacoEditor(){
        this.showMonacoEditor = false;
        this.logDetails = null;
        this.logName = '';
    }

    @api
    async displayLogsDetailsFromLogList(logDetails, logName){
        this.logDetails = logDetails;
        let formatLogDetails = await this.formatLogDetails(logDetails);
        await this.renderedMonacoEditor();
        if(this.template.querySelector('.sfdlMonacoEditor')){
            this.logName = logName;
            monaco.editor.create(this.template.querySelector('.sfdlMonacoEditor'), {
                value: formatLogDetails,
                automaticLayout: true
            });
        }
    }

    async formatLogDetails(logDetails){
        let logDetailsArrayOfLines = logDetails.split('\n');
        let logDetailsFormatted; 
        this.checkboxOptions.forEach((option) => {
            if(option.checked){
                logDetailsFormatted = invokeFilterFormatFunctions(logDetailsFormatted ? logDetailsFormatted : logDetailsArrayOfLines, option.name);
                logDetailsFormatted.join('\n');
            }
        })
        
        return logDetailsFormatted ? logDetailsFormatted.join('\n') : logDetails;
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

    handleCheckboxOptions(event){
        this.checkboxOptions.forEach((option) => {
            if(option.name === event.detail.function2Execute){
                option.checked = event.detail.checked;
            }
        });

        this.renderLogDetailsAfterManipulationOptionSelection();
    }

    renderLogDetailsAfterManipulationOptionSelection(){
        if(this.logDetails){
            this.displayLogsDetailsFromLogList(this.logDetails, this.logName);
        }
    }
}