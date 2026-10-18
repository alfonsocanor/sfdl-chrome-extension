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

//What the listings tell before anything is compared: which org holds a
//component. A filter on what only a comparison tells would hide every
//component nobody compared yet.
const FILTERS = [
    { value: ALL, label: 'All' },
    { value: LEFT_ONLY, label: 'Only left', statuses: [LEFT_ONLY] },
    { value: RIGHT_ONLY, label: 'Only right', statuses: [RIGHT_ONLY] }
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
//nothing is compared until asked: a click on a component compares it. The
//component on screen lists its files.
export default class CompareResults extends LightningElement{
    @api selectedName;
    @api selectedPath;
    @api typeLabel = 'components';
    @api leftName = 'the left org';
    @api rightName = 'the right org';

    //[{ name, presence, status, files: [{ path, status }], leftModified,
    //rightModified }], a modified being { date, by }.
    @api
    get components(){
        return this._components;
    }
    set components(components){
        this._components = components || [];

        //A new listing starts over, a component compared in the same listing
        //keeps the filter where it was.
        const namesKey = this._components.map(component => component.name).join('\n');
        if(namesKey !== this.namesKey){
            this.namesKey = namesKey;
            this.statusFilter = ALL;
            this.rowLimit = ROWS_PER_PAGE;
        }
    }

    _components = [];
    namesKey;
    statusFilter = ALL;
    searchText = '';
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

        const everythingIdentical = this.countOf([IDENTICAL]) === this._components.length;

        return everythingIdentical ?
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

    get visibleRows(){
        return this.filteredComponents.slice(0, this.rowLimit).map(component => {
            const isSelected = component.name === this.selectedName;
            const files = component.files || [];

            return {
                name: component.name,
                statusLabel: STATUS_LABELS[component.status],
                badgeClass: badgeClass(component.status),
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
