import { LightningElement, api } from 'lwc';
import * as monaco from 'monaco-editor';
import { monacoThemes, tokenizerRoot } from 'util/monacoThemes';
import { adoptStyleSheet } from 'sfdl/styleSheets';
import { adoptCompareTheme } from 'sfdl/compareTheme';
import { css } from './diffViewerCss';

//The analyse editor uses the same theme. Monaco themes are global, a second
//theme would repaint whichever editor was created first.
const THEME = 'customDawn';
const APEX_LOG_LANGUAGE = 'apexlog';

const DIFF_EDITOR_OPTIONS = {
    theme: THEME,
    readOnly: true,
    originalEditable: false,
    automaticLayout: true,
    renderSideBySide: true,
    enableSplitViewResizing: true,
    ignoreTrimWhitespace: false,
    renderOverviewRuler: true,
    scrollBeyondLastLine: false,
    minimap: { enabled: false },
    fontLigatures: '',
    //Debug logs run to megabytes, give the diff the time it needs.
    maxComputationTime: 15000,
    maxFileSize: 100
};

function prepareMonaco(){
    const isApexLogRegistered = monaco.languages.getLanguages()
        .some(language => language.id === APEX_LOG_LANGUAGE);

    if(!isApexLogRegistered){
        monaco.languages.register({ id: APEX_LOG_LANGUAGE });
        monaco.languages.setMonarchTokensProvider(APEX_LOG_LANGUAGE, tokenizerRoot);
    }

    monaco.editor.defineTheme(THEME, monacoThemes[THEME]);
}

//Shows the left content against the right content. A side left undefined is
//not there at all, an empty string is a side that is there and empty.
export default class DiffViewer extends LightningElement{
    @api emptyMessage = 'Pick what to compare';
    @api loading = false;
    @api height;

    @api
    get leftContent(){
        return this._leftContent;
    }
    set leftContent(value){
        this._leftContent = value;
        this.markContentStale();
    }

    @api
    get rightContent(){
        return this._rightContent;
    }
    set rightContent(value){
        this._rightContent = value;
        this.markContentStale();
    }

    @api
    get language(){
        return this._language;
    }
    set language(value){
        this._language = value;
        this.markContentStale();
    }

    _leftContent;
    _rightContent;
    _language;
    isContentStale = false;
    isRefreshScheduled = false;
    isComponentConnected = false;

    diffEditor;
    originalModel;
    modifiedModel;

    connectedCallback(){
        this.isComponentConnected = true;
        adoptStyleSheet(css);
        adoptCompareTheme();
    }

    renderedCallback(){
        this.refreshDiff();
    }

    disconnectedCallback(){
        this.isComponentConnected = false;
        this.disposeEditor();
        //A new container comes with the next render, the diff has to be built again.
        this.isContentStale = true;
    }

    get hasContent(){
        return typeof this._leftContent === 'string' || typeof this._rightContent === 'string';
    }

    get viewerStyle(){
        return this.height ? 'height:' + this.height + 'px;' : 'height:100%;';
    }

    get editorClass(){
        return 'sfdl-diff-editor' + (this.hasContent ? '' : ' slds-hide');
    }

    get monacoLanguage(){
        return this._language || 'plaintext';
    }

    //A new content does not always render the template again, the template
    //only reads the sides it needs to tell whether there is anything to show.
    markContentStale(){
        this.isContentStale = true;

        if(!this.isRefreshScheduled){
            this.isRefreshScheduled = true;
            Promise.resolve().then(() => {
                this.isRefreshScheduled = false;
                this.refreshDiff();
            });
        }
    }

    refreshDiff(){
        if(this.isContentStale && this.hasContent && this.isComponentConnected && this.template.querySelector('.sfdl-diff-editor')){
            this.isContentStale = false;
            this.updateDiff();
        }
    }

    updateDiff(){
        if(!this.diffEditor){
            prepareMonaco();
            this.diffEditor = monaco.editor.createDiffEditor(
                this.template.querySelector('.sfdl-diff-editor'),
                DIFF_EDITOR_OPTIONS
            );
        }

        const previousModels = [this.originalModel, this.modifiedModel];

        this.originalModel = monaco.editor.createModel(this._leftContent || '', this.monacoLanguage);
        this.modifiedModel = monaco.editor.createModel(this._rightContent || '', this.monacoLanguage);
        this.diffEditor.setModel({ original: this.originalModel, modified: this.modifiedModel });

        //Only once the editor holds the new models, or it would render disposed ones.
        previousModels.forEach(model => model && model.dispose());
    }

    disposeEditor(){
        if(this.diffEditor){
            this.diffEditor.dispose();
            this.diffEditor = null;
        }

        [this.originalModel, this.modifiedModel].forEach(model => model && model.dispose());
        this.originalModel = null;
        this.modifiedModel = null;
    }
}
