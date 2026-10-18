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
const PREVIOUS_ICON = '/slds/icons/utility/chevronup.svg';
const NEXT_ICON = '/slds/icons/utility/chevrondown.svg';

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

function linesOf(startLineNumber, endLineNumber){
    //An end line of 0 means the change has no line on that side.
    return endLineNumber ? endLineNumber - startLineNumber + 1 : 0;
}

function plural(count, word){
    return count + ' ' + word + (count === 1 ? '' : 's');
}

//Shows the left content against the right content. A side left undefined is
//not there at all, an empty string is a side that is there and empty.
export default class DiffViewer extends LightningElement{
    @api emptyMessage = 'Pick what to compare';
    @api loading = false;
    @api height;
    @api leftLabel;
    @api rightLabel;
    //A line about the comparison itself, shown above the diff.
    @api notice;
    //Replaces the explanation that follows "No differences."
    @api identicalMessage;
    //left or right: that side is being loaded again. Its pane alone spins and
    //hides what it holds while the other side stays readable.
    @api loadingSide;
    @api sideLoadingMessage;
    //What the org of each side is doing, { label, title, tone }, tone being
    //error or warning. Written next to the name of the side.
    @api leftStatus;
    @api rightStatus;
    //The bar only comes with something to compare, for a parent that has
    //nothing to show in it before.
    @api hideEmptySummary = false;

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

    lineChanges = null;
    isComputing = false;
    currentChangeIndex = -1;
    shouldRevealFirstChange = false;
    isInline = false;
    ignoreWhitespace = false;

    previousIcon = PREVIOUS_ICON;
    nextIcon = NEXT_ICON;
    //Where the left pane ends, read from monaco since the split can be dragged.
    leftPaneWidth;

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

    get showEmptyMessage(){
        return !this.hasContent && !this.loading;
    }

    //Over a diff already on screen the spinner is enough.
    get loadingMessage(){
        return this.hasContent ? undefined : this.emptyMessage;
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

    get leftStatusClass(){
        return this.statusClass(this.leftStatus);
    }

    get rightStatusClass(){
        return this.statusClass(this.rightStatus);
    }

    statusClass(status){
        return 'sfdl-diff-side-status' + (status && status.tone ? ' sfdl-diff-side-status_' + status.tone : '');
    }

    get isSideLoading(){
        return !!this.loadingSide && this.hasContent;
    }

    get stencilPanes(){
        return this.isInline ? 1 : 2;
    }

    get sideLoadingLabel(){
        return this.sideLoadingMessage || 'Loading';
    }

    get loadingLabel(){
        return this.loadingMessage || 'Comparing';
    }

    //Inline, both sides share one pane, and the whole of it waits.
    get sideLoadingStyle(){
        if(this.isInline){
            return 'left:0;right:0;';
        }

        const leftPane = this.leftPaneWidth ? this.leftPaneWidth + 'px' : '50%';

        return this.loadingSide === 'left' ?
            'left:0;width:' + leftPane + ';' :
            'left:' + leftPane + ';right:0;';
    }

    //The bar stays with nothing to compare, what it counts only holds while
    //there is something.
    get changeCount(){
        return this.hasContent && this.lineChanges ? this.lineChanges.length : 0;
    }

    get showControls(){
        return this.hasContent || this.loading;
    }

    get showSummary(){
        return !this.hideEmptySummary || this.showControls;
    }

    //The comparison, or one side of it, is on its way. The bar only says it
    //is comparing meanwhile, there is nothing yet to walk or show otherwise.
    get isProcessing(){
        return !!this.loading || this.isSideLoading;
    }

    //The arrows only come with differences to step through.
    get hasDifferences(){
        return this.changeCount > 0;
    }

    get showArrows(){
        return this.hasDifferences && !this.isProcessing;
    }

    get hasNoDifferences(){
        return this.hasContent && !this.isProcessing && !this.isComputing && this.lineChanges !== null && this.changeCount === 0;
    }

    get showInlineOption(){
        return !this.isProcessing && !this.hasNoDifferences;
    }

    //Identical sides have nothing to show otherwise, unless ignoring the
    //whitespace is what made them so: it has to stay to be unticked. It stays
    //too while the diff is counted again after it is ticked.
    get showWhitespaceOption(){
        return !this.isProcessing && (!this.hasNoDifferences || this.ignoreWhitespace);
    }

    get isNavigationDisabled(){
        return this.isComputing;
    }

    get changesLabel(){
        if(!this.hasContent || this.isProcessing || this.isComputing || this.lineChanges === null){
            return 'Comparing...';
        }

        if(!this.changeCount){
            return 'No differences';
        }

        return this.currentChangeIndex >= 0 ?
            (this.currentChangeIndex + 1) + ' of ' + plural(this.changeCount, 'difference') :
            plural(this.changeCount, 'difference');
    }

    get changesTitle(){
        if(!this.changeCount){
            return '';
        }

        const leftLines = this.lineChanges.reduce((total, change) =>
            total + linesOf(change.originalStartLineNumber, change.originalEndLineNumber), 0);
        const rightLines = this.lineChanges.reduce((total, change) =>
            total + linesOf(change.modifiedStartLineNumber, change.modifiedEndLineNumber), 0);

        return plural(leftLines, 'line') + ' on the left and ' + plural(rightLines, 'line') + ' on the right differ';
    }

    get noDifferencesText(){
        return 'No differences. ' + this.noDifferencesDetail;
    }

    get noDifferencesDetail(){
        if(this.identicalMessage){
            return this.identicalMessage;
        }

        if((this._leftContent || '') === (this._rightContent || '')){
            return 'Both sides are identical.';
        }

        return this.ignoreWhitespace ?
            'The sides only differ in whitespace.' :
            'Both sides match line by line.';
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
                {
                    ...DIFF_EDITOR_OPTIONS,
                    renderSideBySide: !this.isInline,
                    ignoreTrimWhitespace: this.ignoreWhitespace
                }
            );
            this.diffEditor.onDidUpdateDiff(() => this.handleDiffUpdated());

            const originalEditor = this.diffEditor.getOriginalEditor();
            if(originalEditor.onDidLayoutChange){
                originalEditor.onDidLayoutChange(layoutInfo => {
                    this.leftPaneWidth = layoutInfo.width;
                });
            }
        }

        this.lineChanges = null;
        this.isComputing = true;
        this.currentChangeIndex = -1;
        this.shouldRevealFirstChange = true;

        const previousModels = [this.originalModel, this.modifiedModel];

        this.originalModel = monaco.editor.createModel(this._leftContent || '', this.monacoLanguage);
        this.modifiedModel = monaco.editor.createModel(this._rightContent || '', this.monacoLanguage);
        this.diffEditor.setModel({ original: this.originalModel, modified: this.modifiedModel });

        //Only once the editor holds the new models, or it would render disposed ones.
        previousModels.forEach(model => model && model.dispose());
    }

    handleDiffUpdated(){
        const lineChanges = this.diffEditor && this.diffEditor.getLineChanges();

        //Monaco reports the diff before it is computed as well.
        if(!lineChanges){
            return;
        }

        this.lineChanges = lineChanges;
        this.isComputing = false;
        this.currentChangeIndex = -1;

        //A new comparison opens on its first difference.
        if(this.shouldRevealFirstChange && lineChanges.length){
            this.shouldRevealFirstChange = false;
            this.goToChange(0);
        }
    }

    handleNextChange(){
        this.goToChange(this.currentChangeIndex < 0 ? 0 : this.currentChangeIndex + 1);
    }

    handlePreviousChange(){
        this.goToChange(this.currentChangeIndex < 0 ? this.changeCount - 1 : this.currentChangeIndex - 1);
    }

    goToChange(index){
        if(!this.changeCount){
            return;
        }

        this.currentChangeIndex = (index + this.changeCount) % this.changeCount;

        //The right side has every line of the diff in both layouts: in the
        //inline one it is the only editor, and a change that only removed lines
        //starts on the line right before the removed ones.
        const change = this.lineChanges[this.currentChangeIndex];
        const lineNumber = Math.max(1, change.modifiedStartLineNumber);
        const modifiedEditor = this.diffEditor.getModifiedEditor();

        modifiedEditor.revealLineInCenter(lineNumber);
        modifiedEditor.setPosition({ lineNumber, column: 1 });
    }

    handleInlineChange(event){
        this.isInline = event.target.checked;

        if(this.diffEditor){
            this.diffEditor.updateOptions({ renderSideBySide: !this.isInline });
        }
    }

    handleWhitespaceChange(event){
        this.ignoreWhitespace = event.target.checked;

        if(this.diffEditor){
            this.isComputing = true;
            this.diffEditor.updateOptions({ ignoreTrimWhitespace: this.ignoreWhitespace });
        }
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
