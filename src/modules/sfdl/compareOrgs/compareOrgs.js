import { LightningElement, api } from 'lwc';
import { getCommonApiVersion } from 'sfdl/salesforceConnection';
import { getMetadataType, metadataTypeOptions, languageForFile } from 'sfdl/metadataCatalog';
import { compareFileSets, countByStatus, retrieveOrgFiles, IDENTICAL } from 'sfdl/orgCompare';
import { adoptStyleSheet } from 'sfdl/styleSheets';
import { adoptCompareTheme } from 'sfdl/compareTheme';
import { css } from './compareOrgsCss';

const LEFT = 'left';
const RIGHT = 'right';
const SWAP_ICON = '/slds/icons/utility/sort.svg';
const REFRESH_ICON = '/slds/icons/utility/refresh.svg';

function domainOf(instanceUrl){
    return instanceUrl ? instanceUrl.replace('https://', '') : '';
}

//What the Metadata API and the custom settings reader report, in words.
const STATUS_LABELS = {
    Pending: 'Queued in the org',
    InProgress: 'Retrieving',
    Succeeded: 'Retrieved',
    'Already retrieved': 'Retrieved earlier, refresh to retrieve again'
};

//Every 4 characters of base64 hold 3 bytes, less one byte for each = that
//pads the last group.
function byteLength(base64){
    const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
    return base64.length * 3 / 4 - padding;
}

//A binary file cannot be shown, its size stands for it in the diff.
function contentOf(file){
    if(!file){
        return undefined;
    }

    return file.isBinary ?
        'Binary file of ' + byteLength(file.content) + ' bytes' :
        file.content;
}

function emptySideState(){
    return { status: '', error: undefined, problems: [] };
}

//The metadata of two orgs side by side: pick both orgs and a type, and every
//component either org holds comes back with its status.
export default class CompareOrgs extends LightningElement{
    @api orgs = [];
    @api height;

    @api
    get sessionInformation(){
        return this._sessionInformation;
    }
    set sessionInformation(sessionInformation){
        this._sessionInformation = sessionInformation;

        //The left side starts on the org of the header and goes its own way
        //as soon as it has one.
        if(!this.leftOrgSession && sessionInformation && sessionInformation.instanceUrl){
            this.leftOrgSession = { instanceUrl: sessionInformation.instanceUrl, authToken: sessionInformation.authToken };
            this.runComparison();
        }
    }

    _sessionInformation;
    leftOrgSession;
    rightOrgSession;
    typeKey;
    includeManaged = false;

    runSequence = 0;
    isComparing = false;
    hasCompared = false;
    errorMessage;
    apiVersion;
    entries = [];
    selectedPath;
    leftState = emptySideState();
    rightState = emptySideState();

    swapIcon = SWAP_ICON;
    refreshIcon = REFRESH_ICON;
    typeOptions = metadataTypeOptions();

    connectedCallback(){
        adoptStyleSheet(css);
        adoptCompareTheme();
    }

    get containerStyle(){
        return this.height ? 'height:' + this.height + 'px;' : 'height:100%;';
    }

    get orgOptions(){
        return (this.orgs || []).map(org => ({ label: domainOf(org.label), value: org.label }));
    }

    get leftOrgUrl(){
        return this.leftOrgSession ? this.leftOrgSession.instanceUrl : undefined;
    }

    get rightOrgUrl(){
        return this.rightOrgSession ? this.rightOrgSession.instanceUrl : undefined;
    }

    get leftOrgName(){
        return domainOf(this.leftOrgUrl);
    }

    get rightOrgName(){
        return domainOf(this.rightOrgUrl);
    }

    get selectedType(){
        return getMetadataType(this.typeKey);
    }

    get canCompare(){
        return !!(this.leftOrgSession && this.rightOrgSession && this.selectedType);
    }

    get isSwapDisabled(){
        return !this.leftOrgSession && !this.rightOrgSession;
    }

    get isRefreshDisabled(){
        return !this.canCompare || this.isComparing;
    }

    get counts(){
        return countByStatus(this.entries);
    }

    get selectedEntry(){
        return this.entries.find(entry => entry.path === this.selectedPath);
    }

    get leftContent(){
        return this.selectedEntry ? contentOf(this.selectedEntry.left) : undefined;
    }

    get rightContent(){
        return this.selectedEntry ? contentOf(this.selectedEntry.right) : undefined;
    }

    get selectedLanguage(){
        const entry = this.selectedEntry;

        if(!entry || (entry.left || entry.right).isBinary){
            return 'plaintext';
        }

        return languageForFile(entry.path, (entry.left || entry.right).content);
    }

    get selectedNotice(){
        const entry = this.selectedEntry;

        if(!entry){
            return undefined;
        }

        if(!entry.right){
            return entry.path + ' is only in ' + this.leftOrgName + '.';
        }

        if(!entry.left){
            return entry.path + ' is only in ' + this.rightOrgName + '.';
        }

        if(entry.left.isBinary || entry.right.isBinary){
            return entry.path + ' is a binary file, its contents ' +
                (entry.status === IDENTICAL ? 'are the same' : 'differ') + ' in both orgs.';
        }

        return undefined;
    }

    get identicalMessage(){
        return this.selectedEntry ? this.selectedEntry.path + ' is identical in both orgs.' : undefined;
    }

    get typeLabel(){
        return this.selectedType ? this.selectedType.label : 'components';
    }

    get resultsSubtitle(){
        if(!this.selectedType){
            return 'Nothing compared yet';
        }

        return this.selectedType.label + (this.apiVersion ? ' \u00b7 API ' + this.apiVersion : '');
    }

    get sideProgress(){
        return [LEFT, RIGHT].map(side => {
            const state = this[side + 'State'];
            const problemCount = state.problems.length;
            let statusLabel = STATUS_LABELS[state.status] || state.status || 'Waiting';
            let statusClass = 'sfdl-compare-orgs__progress-status';
            let statusTitle = statusLabel;

            if(state.error){
                statusLabel = state.error;
                statusTitle = state.error;
                statusClass += ' sfdl-compare-orgs__progress-status_error';
            } else if(problemCount && !this.isComparing){
                statusLabel = problemCount + (problemCount === 1 ? ' component' : ' components') + ' could not be retrieved';
                statusTitle = state.problems.join('\n');
                statusClass += ' sfdl-compare-orgs__progress-status_warning';
            }

            return {
                side,
                orgName: this[side + 'OrgName'],
                swatchClass: 'sfdl-side-swatch sfdl-side-swatch_' + side,
                statusLabel,
                statusTitle,
                statusClass
            };
        });
    }

    //While retrieving, and afterwards when an org failed or left components out.
    get showProgress(){
        return this.isComparing || [this.leftState, this.rightState].some(state => state.error || state.problems.length);
    }

    get showPanelHint(){
        return !!this.panelHint && !this.isComparing && !this.hasCompared && !this.errorMessage;
    }

    get panelHint(){
        return this.canCompare ? '' : this.emptyMessage;
    }

    get emptyMessage(){
        if(!this.leftOrgSession || !this.rightOrgSession){
            return 'Pick the two orgs to compare.';
        }

        if(!this.selectedType){
            return 'Pick the metadata to compare.';
        }

        if(this.isComparing){
            return 'Retrieving ' + this.selectedType.label + ' from both orgs...';
        }

        return 'Pick a component to see how the two orgs differ.';
    }

    handleOrgChange(event){
        const side = event.currentTarget.dataset.side;
        const org = (this.orgs || []).find(candidate => candidate.label === event.detail.value);

        if(org){
            this[side + 'OrgSession'] = { instanceUrl: org.label, authToken: org.value };
            this.runComparison();
        }
    }

    handleTypeChange(event){
        this.typeKey = event.detail.value;
        this.runComparison();
    }

    handleManagedChange(event){
        this.includeManaged = event.target.checked;
        this.runComparison();
    }

    handleRefresh(){
        this.runComparison({ refresh: true });
    }

    //Both orgs were retrieved already, swapping only compares them the other
    //way round.
    handleSwap(){
        [this.leftOrgSession, this.rightOrgSession] = [this.rightOrgSession, this.leftOrgSession];
        this.runComparison();
    }

    //The comparison opens on its first change, or on its first component when
    //the orgs hold the same of everything.
    openFirstComponent(){
        const firstChange = this.entries.find(entry => entry.status !== IDENTICAL);
        const firstEntry = firstChange || this.entries[0];

        this.selectedPath = firstEntry ? firstEntry.path : undefined;
    }

    handleComponentSelect(event){
        this.selectedPath = event.detail.path;
    }

    resetResults(){
        this.entries = [];
        this.selectedPath = undefined;
        this.errorMessage = undefined;
        this.hasCompared = false;
        this.leftState = emptySideState();
        this.rightState = emptySideState();
    }

    updateSideState(sequence, side, changes){
        if(sequence === this.runSequence){
            this[side + 'State'] = { ...this[side + 'State'], ...changes };
        }
    }

    async runComparison({ refresh = false } = {}){
        const sequence = ++this.runSequence;

        this.resetResults();

        if(!this.canCompare){
            this.isComparing = false;
            return;
        }

        const type = this.selectedType;
        const sessions = { [LEFT]: this.leftOrgSession, [RIGHT]: this.rightOrgSession };
        const includeManaged = this.includeManaged;

        this.isComparing = true;

        try{
            const apiVersion = await getCommonApiVersion(sessions[LEFT], sessions[RIGHT]);

            if(sequence !== this.runSequence){
                return;
            }

            this.apiVersion = apiVersion;

            const results = await Promise.allSettled([LEFT, RIGHT].map(side =>
                retrieveOrgFiles(sessions[side], type, apiVersion, {
                    includeManaged,
                    refresh,
                    onStatus: status => this.updateSideState(sequence, side, { status })
                })
            ));

            //The orgs or the type changed while these were on their way.
            if(sequence !== this.runSequence){
                return;
            }

            const [leftResult, rightResult] = results;

            [[LEFT, leftResult], [RIGHT, rightResult]].forEach(([side, result]) => {
                this.updateSideState(sequence, side, result.status === 'fulfilled' ?
                    { problems: result.value.problems } :
                    { error: result.reason.message });
            });

            if(leftResult.status === 'fulfilled' && rightResult.status === 'fulfilled'){
                this.entries = compareFileSets(leftResult.value.files, rightResult.value.files);
                this.hasCompared = true;
                this.openFirstComponent();
            }
        } catch(error){
            if(sequence !== this.runSequence){
                return;
            }
            this.errorMessage = error.message;
        }

        this.isComparing = false;
    }
}
