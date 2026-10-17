import { LightningElement, api } from 'lwc';
import { DIFFERENT, LEFT_ONLY, RIGHT_ONLY, IDENTICAL, UNAVAILABLE, NOT_COMPARED, COMPARING } from 'sfdl/orgCompare';
import { adoptStyleSheet } from 'sfdl/styleSheets';
import { adoptCompareTheme } from 'sfdl/compareTheme';
import { css } from './compareResultsCss';

const ALL = 'all';
const SEARCH_ICON = '/resources/searchGrey.svg';
//Thousands of standard object names would take the page down rendered at
//once, they are shown a page at a time.
const ROWS_PER_PAGE = 300;
const DEFAULT_BATCH_SIZE = 100;

const STATUS_LABELS = {
    [NOT_COMPARED]: 'In both',
    [COMPARING]: 'Comparing...',
    [DIFFERENT]: 'Different',
    [LEFT_ONLY]: 'Only left',
    [RIGHT_ONLY]: 'Only right',
    [IDENTICAL]: 'Identical',
    [UNAVAILABLE]: 'Not retrieved'
};

const BADGE_COLORS = {
    [NOT_COMPARED]: 'pending',
    [COMPARING]: 'pending',
    [DIFFERENT]: 'different',
    [LEFT_ONLY]: 'left',
    [RIGHT_ONLY]: 'right',
    [IDENTICAL]: 'identical',
    [UNAVAILABLE]: 'identical'
};

const FILTERS = [
    { value: ALL, label: 'All' },
    { value: NOT_COMPARED, label: 'Not compared', statuses: [NOT_COMPARED, COMPARING] },
    { value: DIFFERENT, label: 'Different', statuses: [DIFFERENT] },
    { value: LEFT_ONLY, label: 'Only left', statuses: [LEFT_ONLY] },
    { value: RIGHT_ONLY, label: 'Only right', statuses: [RIGHT_ONLY] },
    { value: IDENTICAL, label: 'Identical', statuses: [IDENTICAL, UNAVAILABLE] }
];

function badgeClass(status){
    return 'sfdl-status-badge sfdl-status-badge_' + BADGE_COLORS[status];
}

function pad(value){
    return String(value).padStart(2, '0');
}

function modifiedLine(side, modified){
    if(!modified || !modified.date){
        return '';
    }

    const date = new Date(modified.date);
    const when = pad(date.getDate()) + '/' + pad(date.getMonth() + 1) + '/' + date.getFullYear() + ' ' +
        pad(date.getHours()) + ':' + pad(date.getMinutes());

    return '\n' + side + ': modified ' + when + (modified.by ? ' by ' + modified.by : '');
}

//The components two orgs hold of a type. Their names come from the listings,
//nothing is compared until asked: a click on a component compares it, and the
//ones ticked are compared together. The component on screen lists its files.
export default class CompareResults extends LightningElement{
    @api selectedName;
    @api selectedPath;
    @api typeLabel = 'components';
    @api leftName = 'the left org';
    @api rightName = 'the right org';
    //How the components of the type come out of an org, for the cost of a
    //comparison: metadata in retrieves of batchSize components, custom
    //settings in two api calls each.
    @api engine = 'metadata';
    @api batchSize = DEFAULT_BATCH_SIZE;

    //[{ name, presence, status, files: [{ path, status }], leftModified,
    //rightModified }], a modified being { date, by }.
    @api
    get components(){
        return this._components;
    }
    set components(components){
        this._components = components || [];

        //A new listing starts over, a component compared in the same listing
        //keeps the filter and the selection where they were.
        const namesKey = this._components.map(component => component.name).join('\n');
        if(namesKey !== this.namesKey){
            this.namesKey = namesKey;
            this.statusFilter = ALL;
            this.checkedNames = new Set();
            this.rowLimit = ROWS_PER_PAGE;
        }
    }

    _components = [];
    namesKey;
    statusFilter = ALL;
    searchText = '';
    checkedNames = new Set();
    rowLimit = ROWS_PER_PAGE;
    searchIcon = SEARCH_ICON;

    connectedCallback(){
        adoptStyleSheet(css);
        adoptCompareTheme();
    }

    countOf(statuses){
        return this._components.filter(component => !statuses || statuses.includes(component.status)).length;
    }

    get summaryMessage(){
        if(!this._components.length){
            return 'Neither org holds any ' + this.typeLabel + '.';
        }

        const allCompared = !this.countOf([NOT_COMPARED, COMPARING]);
        const nothingChanged = !this.countOf([DIFFERENT, LEFT_ONLY, RIGHT_ONLY]);

        return allCompared && nothingChanged ?
            'No differences: the ' + this._components.length + ' ' + this.typeLabel + ' are identical in both orgs.' :
            '';
    }

    get summaryClass(){
        return 'sfdl-compare-results__summary' + (this._components.length ? ' sfdl-compare-results__summary_identical' : '');
    }

    get statusFilters(){
        return FILTERS.map(filter => {
            const isActive = filter.value === this.statusFilter;
            const colorClass = filter.statuses ? ' ' + badgeClass(filter.statuses[0]) : '';

            return {
                ...filter,
                count: this.countOf(filter.statuses),
                ariaPressed: isActive ? 'true' : 'false',
                title: 'Show the ' + (filter.value === ALL ? 'all' : filter.label.toLowerCase()) + ' ' + this.typeLabel,
                buttonClass: 'sfdl-status-filter' + colorClass + (isActive ? ' sfdl-status-filter_active' : '')
            };
        });
    }

    get searchWords(){
        return this.searchText.toLowerCase().split(/\s+/).filter(word => word);
    }

    get filteredComponents(){
        const statuses = FILTERS.find(filter => filter.value === this.statusFilter).statuses;
        const searchWords = this.searchWords;

        return this._components.filter(component =>
            (!statuses || statuses.includes(component.status)) &&
            searchWords.every(word => component.name.toLowerCase().includes(word))
        );
    }

    //The components that can be ticked: everything but what is comparing.
    get selectableNames(){
        return this.filteredComponents
            .filter(component => component.status !== COMPARING)
            .map(component => component.name);
    }

    get visibleRows(){
        return this.filteredComponents.slice(0, this.rowLimit).map(component => {
            const isSelected = component.name === this.selectedName;
            const files = component.files || [];

            return {
                name: component.name,
                statusLabel: STATUS_LABELS[component.status],
                badgeClass: badgeClass(component.status),
                isChecked: this.checkedNames.has(component.name),
                isComparing: component.status === COMPARING,
                title: component.name + modifiedLine('Left', component.leftModified) + modifiedLine('Right', component.rightModified),
                rowClass: 'sfdl-compare-results__row' + (isSelected ? ' sfdl-compare-results__row_selected' : ''),
                showFiles: isSelected && files.length > 0,
                files: files.map(file => this.fileRow(component.name, file))
            };
        });
    }

    //A file is named from inside its component: Tier__c.field under
    //fields of Account, invoiceList.js in the invoiceList bundle.
    fileRow(componentName, file){
        let fileName = file.path.split('/').slice(1).join('/');

        if(fileName.startsWith(componentName + '/')){
            fileName = fileName.slice(componentName.length + 1);
        }

        return {
            path: file.path,
            fileName,
            statusLabel: STATUS_LABELS[file.status],
            badgeClass: badgeClass(file.status),
            fileClass: 'sfdl-compare-results__file' + (file.path === this.selectedPath ? ' sfdl-compare-results__file_selected' : '')
        };
    }

    get hasMoreRows(){
        return this.filteredComponents.length > this.rowLimit;
    }

    get showMoreLabel(){
        const remaining = this.filteredComponents.length - this.rowLimit;
        return 'Show ' + Math.min(remaining, ROWS_PER_PAGE) + ' more of the ' + remaining + ' left';
    }

    get emptyListMessage(){
        if(!this._components.length || this.filteredComponents.length){
            return '';
        }

        return this.searchWords.length ? 'No component matches the filter' : 'No component has this status';
    }

    get checkedCount(){
        return this.checkedNames.size;
    }

    get areAllShownSelected(){
        const names = this.selectableNames;
        return names.length > 0 && names.every(name => this.checkedNames.has(name));
    }

    get isSelectAllDisabled(){
        return !this.selectableNames.length;
    }

    get selectAllTitle(){
        return this.areAllShownSelected ? 'Unselect the components shown' : 'Select the components shown';
    }

    get isCompareDisabled(){
        return !this.checkedCount;
    }

    get compareLabel(){
        return this.checkedCount ? 'Compare selected (' + this.checkedCount + ')' : 'Compare selected';
    }

    get compareTitle(){
        return this.checkedCount ? 'Retrieve the selected components from both orgs and compare them' : 'Tick the components to compare first';
    }

    //What comparing the selection costs each org, so a big selection is a
    //decision rather than a surprise.
    get costHint(){
        const count = this.checkedCount;

        if(!count){
            return '';
        }

        if(this.engine === 'customSettings'){
            return (count * 2) + ' api calls per org';
        }

        const retrieves = Math.ceil(count / (this.batchSize || DEFAULT_BATCH_SIZE));
        return retrieves + (retrieves === 1 ? ' retrieve' : ' retrieves') + ' per org';
    }

    handleStatusFilter(event){
        this.statusFilter = event.currentTarget.dataset.filter;
        this.rowLimit = ROWS_PER_PAGE;
    }

    handleSearch(event){
        this.searchText = event.target.value;
        this.rowLimit = ROWS_PER_PAGE;
    }

    handleShowMore(){
        this.rowLimit += ROWS_PER_PAGE;
    }

    handleCheck(event){
        const checkedNames = new Set(this.checkedNames);

        if(event.target.checked){
            checkedNames.add(event.target.dataset.name);
        } else {
            checkedNames.delete(event.target.dataset.name);
        }

        this.checkedNames = checkedNames;
    }

    handleSelectAll(event){
        const checkedNames = new Set(this.checkedNames);

        this.selectableNames.forEach(name => {
            if(event.target.checked){
                checkedNames.add(name);
            } else {
                checkedNames.delete(name);
            }
        });

        this.checkedNames = checkedNames;
    }

    handleCompareSelected(){
        const names = this._components
            .map(component => component.name)
            .filter(name => this.checkedNames.has(name));

        this.checkedNames = new Set();
        this.dispatchEvent(new CustomEvent('comparerequest', { detail: { names } }));
    }

    handleOpen(event){
        this.openComponent(event.currentTarget.dataset.name);
    }

    openComponent(name){
        this.dispatchEvent(new CustomEvent('componentopen', { detail: { name } }));
    }

    handleOpenFile(event){
        this.dispatchEvent(new CustomEvent('fileopen', {
            detail: { name: event.currentTarget.dataset.name, path: event.currentTarget.dataset.path }
        }));
    }

    //Up and down open the previous and the next component.
    handleRowKeyDown(event){
        if(event.key !== 'ArrowDown' && event.key !== 'ArrowUp'){
            return;
        }

        event.preventDefault();

        const rows = [...this.template.querySelectorAll('.sfdl-compare-results__open')];
        const index = rows.indexOf(event.currentTarget);
        const nextRow = rows[(index + (event.key === 'ArrowDown' ? 1 : -1) + rows.length) % rows.length];

        nextRow.focus();
        this.openComponent(nextRow.dataset.name);
    }
}
