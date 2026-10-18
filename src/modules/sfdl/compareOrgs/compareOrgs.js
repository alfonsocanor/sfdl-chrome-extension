import { LightningElement, api } from 'lwc';
import { getCommonApiVersion } from 'sfdl/salesforceConnection';
import { getMetadataType, metadataTypeOptions, languageForFile } from 'sfdl/metadataCatalog';
import {
    listOrgComponents,
    compareComponents,
    IDENTICAL,
    LEFT_ONLY,
    RIGHT_ONLY,
    NOT_COMPARED,
    COMPARING
} from 'sfdl/orgCompare';
import { adoptStyleSheet } from 'sfdl/styleSheets';
import { adoptCompareTheme } from 'sfdl/compareTheme';
import { css } from './compareOrgsCss';

const LEFT = 'left';
const RIGHT = 'right';
const BOTH = 'both';
const SWAP_ICON = '/slds/icons/utility/sort.svg';

//What the Metadata API and the custom settings reader report, in words.
const STATUS_LABELS = {
    Pending: 'Queued in the org',
    InProgress: 'Retrieving',
    Succeeded: 'Retrieved',
    'Already retrieved': 'Unchanged since it was retrieved'
};

function domainOf(instanceUrl){
    return instanceUrl ? instanceUrl.replace('https://', '') : '';
}

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

//The listing of each org, by name: what both hold, what only one holds, and
//when each last changed it.
function mergeListings(leftComponents, rightComponents){
    const components = new Map();
    const modified = component => ({ date: component.lastModifiedDate, by: component.lastModifiedByName });

    leftComponents.forEach(component => {
        components.set(component.name, { name: component.name, presence: LEFT, status: LEFT_ONLY, leftModified: modified(component) });
    });

    rightComponents.forEach(component => {
        const existing = components.get(component.name);

        components.set(component.name, existing ?
            { ...existing, presence: BOTH, status: NOT_COMPARED, rightModified: modified(component) } :
            { name: component.name, presence: RIGHT, status: RIGHT_ONLY, rightModified: modified(component) });
    });

    return [...components.values()].sort((a, b) => a.name.localeCompare(b.name));
}

//The first file worth looking at: the first that differs, or the first one.
function firstFilePath(component){
    const files = component.files || [];
    const firstChange = files.find(file => file.status !== IDENTICAL);
    const file = firstChange || files[0];

    return file ? file.path : undefined;
}

//The metadata of two orgs side by side. Picking a type lists the names both
//orgs hold, a call per org; contents are only retrieved for the component
//opened, so a big org is never retrieved whole.
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
        //as soon as it has one, unless the right side has that org already.
        if(!this.leftOrgSession && sessionInformation && sessionInformation.instanceUrl &&
            sessionInformation.instanceUrl !== this.rightOrgUrl){
            this.leftOrgSession = { instanceUrl: sessionInformation.instanceUrl, authToken: sessionInformation.authToken };
            this.runListing();
        }
    }

    _sessionInformation;
    leftOrgSession;
    rightOrgSession;
    typeKey;

    listSequence = 0;
    isListing = false;
    hasListed = false;
    errorMessage;
    apiVersion;
    components = [];
    selectedName;
    selectedPath;
    leftState = emptySideState();
    rightState = emptySideState();
    activeComparisons = 0;
    //Comparisons run one after the other, so the orgs never package two
    //retrieves of ours at once.
    comparisonQueue = Promise.resolve();
    //What each org listed of the type on screen, so a new org on one side
    //only lists that side again.
    listings = { [LEFT]: null, [RIGHT]: null };
    listedTypeKey;
    listingMessage;
    //The api version two orgs share, asked once per pair of orgs.
    commonApiVersions = new Map();

    swapIcon = SWAP_ICON;
    typeOptions = metadataTypeOptions();

    connectedCallback(){
        adoptStyleSheet(css);
        adoptCompareTheme();
    }

    get containerStyle(){
        return this.height ? 'height:' + this.height + 'px;' : 'height:100%;';
    }

    //Each side offers the orgs the other side has not taken, an org is never
    //compared against itself.
    orgOptionsBesides(takenOrgUrl){
        return (this.orgs || [])
            .filter(org => org.label !== takenOrgUrl)
            .map(org => ({ label: domainOf(org.label), value: org.label }));
    }

    get leftOrgOptions(){
        return this.orgOptionsBesides(this.rightOrgUrl);
    }

    get rightOrgOptions(){
        return this.orgOptionsBesides(this.leftOrgUrl);
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

    get typeLabel(){
        return this.selectedType ? this.selectedType.label : 'components';
    }

    get canCompare(){
        return !!(this.leftOrgSession && this.rightOrgSession && this.selectedType);
    }

    get isSwapDisabled(){
        return !this.leftOrgSession && !this.rightOrgSession;
    }

    get selectedComponent(){
        return this.components.find(component => component.name === this.selectedName);
    }

    get selectedEntry(){
        const component = this.selectedComponent;
        return component && component.files ? component.files.find(file => file.path === this.selectedPath) : undefined;
    }

    get isSelectedComparing(){
        return !!this.selectedComponent && this.selectedComponent.status === COMPARING;
    }

    get isDiffLoading(){
        return this.isListing || this.isSelectedComparing;
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

    get sideProgress(){
        const isBusy = this.isListing || this.activeComparisons > 0;

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
            } else if(problemCount && !isBusy){
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

    //While listing or retrieving, and afterwards when an org failed or left
    //components out.
    get showProgress(){
        return this.isListing || this.activeComparisons > 0 ||
            [this.leftState, this.rightState].some(state => state.error || state.problems.length);
    }

    get panelHint(){
        return this.canCompare ? '' : this.emptyMessage;
    }

    get showPanelHint(){
        return !!this.panelHint && !this.isListing && !this.hasListed && !this.errorMessage;
    }

    get emptyMessage(){
        if(!this.leftOrgSession || !this.rightOrgSession){
            return 'Pick the two orgs to compare.';
        }

        if(!this.selectedType){
            return 'Pick the metadata to compare.';
        }

        if(this.isSelectedComparing){
            return 'Comparing ' + this.selectedName + '...';
        }

        if(this.isListing){
            return this.listingMessage;
        }

        return 'Open a component to compare it.';
    }

    handleOrgChange(event){
        const side = event.currentTarget.dataset.side;
        const otherOrgUrl = side === LEFT ? this.rightOrgUrl : this.leftOrgUrl;
        const org = (this.orgs || []).find(candidate => candidate.label === event.detail.value);

        if(org && org.label !== otherOrgUrl){
            this[side + 'OrgSession'] = { instanceUrl: org.label, authToken: org.value };
            this.runListing({ changedSide: side });
        }
    }

    handleTypeChange(event){
        this.typeKey = event.detail.value;
        this.runListing();
    }

    handleSwap(){
        [this.leftOrgSession, this.rightOrgSession] = [this.rightOrgSession, this.leftOrgSession];

        //With everything listed and nothing on its way, the two sides only
        //trade places and no org is asked anything.
        if(this.hasListed && !this.isListing && !this.activeComparisons){
            this.swapResults();
        } else {
            this.runListing();
        }
    }

    swapResults(){
        const swapStatus = status => (status === LEFT_ONLY ? RIGHT_ONLY : status === RIGHT_ONLY ? LEFT_ONLY : status);
        const swapPresence = presence => (presence === LEFT ? RIGHT : presence === RIGHT ? LEFT : presence);

        this.components = this.components.map(component => ({
            ...component,
            presence: swapPresence(component.presence),
            status: swapStatus(component.status),
            leftModified: component.rightModified,
            rightModified: component.leftModified,
            files: component.files && component.files.map(file => ({
                ...file,
                left: file.right,
                right: file.left,
                status: swapStatus(file.status)
            }))
        }));
        this.listings = { [LEFT]: this.listings[RIGHT], [RIGHT]: this.listings[LEFT] };
        [this.leftState, this.rightState] = [this.rightState, this.leftState];
    }

    handleComponentOpen(event){
        this.openComponent(event.detail.name);
    }

    handleFileOpen(event){
        this.selectedName = event.detail.name;
        this.selectedPath = event.detail.path;
    }

    //A component already compared opens on its first difference, one that was
    //not is compared first.
    openComponent(name){
        const component = this.components.find(candidate => candidate.name === name);

        if(!component){
            return;
        }

        this.selectedName = name;
        this.selectedPath = firstFilePath(component);

        if(!component.files && component.status !== COMPARING){
            this.compare([name], { open: name });
        }
    }

    resetResults(){
        this.components = [];
        this.selectedName = undefined;
        this.selectedPath = undefined;
        this.errorMessage = undefined;
        this.hasListed = false;
        this.leftState = emptySideState();
        this.rightState = emptySideState();
    }

    updateSideState(side, changes){
        this[side + 'State'] = { ...this[side + 'State'], ...changes };
    }

    updateComponents(changesByName){
        this.components = this.components.map(component =>
            (changesByName.has(component.name) ? { ...component, ...changesByName.get(component.name) } : component)
        );
    }

    commonApiVersion(leftSession, rightSession){
        const key = [leftSession.instanceUrl, rightSession.instanceUrl].sort().join('|');

        if(!this.commonApiVersions.has(key)){
            this.commonApiVersions.set(key, getCommonApiVersion(leftSession, rightSession).catch(error => {
                this.commonApiVersions.delete(key);
                throw error;
            }));
        }

        return this.commonApiVersions.get(key);
    }

    //Lists both orgs, or only the org of changedSide when the other one is
    //listed already: the list stays on screen meanwhile, and what was compared
    //before is compared again against the new org, in one go.
    async runListing({ changedSide } = {}){
        const sequence = ++this.listSequence;
        const type = this.selectedType;
        const otherSide = changedSide === LEFT ? RIGHT : LEFT;
        const keepsOtherSide = !!changedSide && this.hasListed && !!this.listings[otherSide] && this.listedTypeKey === this.typeKey;
        const comparedBefore = keepsOtherSide ? this.components.filter(component => component.files).map(component => component.name) : [];
        const selectedName = keepsOtherSide ? this.selectedName : undefined;

        if(keepsOtherSide){
            //What was compared against the org that left cannot stay on screen.
            this.errorMessage = undefined;
            this[changedSide + 'State'] = emptySideState();
            this.updateComponents(new Map(
                [...comparedBefore, selectedName].filter(name => name).map(name => [name, { status: COMPARING, files: undefined }])
            ));
        } else {
            this.resetResults();
            this.listings = { [LEFT]: null, [RIGHT]: null };
        }

        if(!this.canCompare){
            this.isListing = false;
            return;
        }

        const sessions = { [LEFT]: this.leftOrgSession, [RIGHT]: this.rightOrgSession };
        let sidesToList = keepsOtherSide ? [changedSide] : [LEFT, RIGHT];

        this.isListing = true;
        this.listingMessage = 'Listing the ' + type.label + ' of ' + (keepsOtherSide ? this[changedSide + 'OrgName'] : 'both orgs') + '...';
        sidesToList.forEach(side => this.updateSideState(side, { status: 'Listing the components', error: undefined }));

        try{
            const apiVersion = await this.commonApiVersion(sessions[LEFT], sessions[RIGHT]);

            if(sequence !== this.listSequence){
                return;
            }

            //Another api version lists both orgs in its own terms.
            if(apiVersion !== this.apiVersion && sidesToList.length === 1){
                sidesToList = [LEFT, RIGHT];
                this.updateSideState(otherSide, { status: 'Listing the components' });
            }

            this.apiVersion = apiVersion;

            const results = await Promise.allSettled(sidesToList.map(side =>
                listOrgComponents(sessions[side], type, apiVersion)
            ));

            //The orgs or the type changed while these were on their way.
            if(sequence !== this.listSequence){
                return;
            }

            let hasFailed = false;

            sidesToList.forEach((side, index) => {
                const result = results[index];

                if(result.status === 'fulfilled'){
                    this.listings[side] = result.value;
                    this.updateSideState(side, { status: 'Listed' });
                } else {
                    this.listings[side] = null;
                    hasFailed = true;
                    this.updateSideState(side, { error: result.reason.message });
                }
            });

            if(hasFailed){
                this.components = [];
                this.hasListed = false;
                this.selectedName = undefined;
                this.selectedPath = undefined;
            } else {
                this.components = mergeListings(this.listings[LEFT], this.listings[RIGHT]);
                this.listedTypeKey = type.key;
                this.hasListed = true;
                this.compareAgain(comparedBefore, selectedName);
            }
        } catch(error){
            if(sequence !== this.listSequence){
                return;
            }
            this.errorMessage = error.message;
        }

        this.isListing = false;
    }

    //The components compared against the org that left, compared against the
    //new one in a single comparison. The other org has them cached already,
    //only the new org retrieves anything.
    compareAgain(comparedBefore, selectedName){
        const listedNames = new Set(this.components.map(component => component.name));
        const names = [...new Set([...comparedBefore, selectedName])].filter(name => name && listedNames.has(name));

        if(!listedNames.has(selectedName)){
            this.selectedName = undefined;
            this.selectedPath = undefined;
        }

        if(names.length){
            this.compare(names, { open: this.selectedName });
        }
    }

    compare(names, { open } = {}){
        const sequence = this.listSequence;
        const targets = this.components.filter(component => names.includes(component.name) && component.status !== COMPARING);

        if(!targets.length){
            return this.comparisonQueue;
        }

        const previousStatuses = new Map(targets.map(component => [component.name, { status: component.status }]));
        this.updateComponents(new Map(targets.map(component => [component.name, { status: COMPARING }])));
        this.activeComparisons++;

        const type = this.selectedType;
        const apiVersion = this.apiVersion;
        const sessions = { [LEFT]: this.leftOrgSession, [RIGHT]: this.rightOrgSession };

        const runComparison = async () => {
            const result = await compareComponents(sessions[LEFT], sessions[RIGHT], type, apiVersion,
                targets.map(({ name, presence, leftModified, rightModified }) => ({
                    name,
                    presence,
                    leftVersion: leftModified && leftModified.date,
                    rightVersion: rightModified && rightModified.date
                })),
                {
                    onStatus: (side, status) => {
                        if(sequence === this.listSequence){
                            this.updateSideState(side, { status, error: undefined });
                        }
                    }
                });

            //Another listing took over while this comparison ran.
            if(sequence !== this.listSequence){
                return;
            }

            [LEFT, RIGHT].forEach(side => {
                const outcome = result[side];
                this.updateSideState(side, outcome.error ?
                    { error: outcome.error } :
                    { problems: [...this[side + 'State'].problems, ...outcome.problems] });
            });

            if(result.components.size){
                this.updateComponents(new Map([...result.components].map(([name, compared]) => [
                    name, { status: compared.status, files: compared.entries }
                ])));
            } else {
                this.updateComponents(previousStatuses);
            }

            //The file on screen stays on screen when the component still has
            //it, otherwise the component opens on its first difference.
            if(open && this.selectedName === open){
                const files = this.selectedComponent.files || [];
                if(!files.some(file => file.path === this.selectedPath)){
                    this.selectedPath = firstFilePath(this.selectedComponent);
                }
            }
        };

        this.comparisonQueue = this.comparisonQueue
            .then(runComparison)
            .catch(error => {
                if(sequence === this.listSequence){
                    this.errorMessage = error.message;
                    this.updateComponents(previousStatuses);
                }
            })
            .then(() => {
                this.activeComparisons--;
            });

        return this.comparisonQueue;
    }
}
