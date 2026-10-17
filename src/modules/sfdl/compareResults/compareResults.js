import { LightningElement, api } from 'lwc';
import { DIFFERENT, LEFT_ONLY, RIGHT_ONLY, IDENTICAL, countByStatus } from 'sfdl/orgCompare';
import { adoptStyleSheet } from 'sfdl/styleSheets';
import { adoptCompareTheme } from 'sfdl/compareTheme';
import { css } from './compareResultsCss';

const CHANGES = 'changes';
const ALL = 'all';
const SEARCH_ICON = '/resources/searchGrey.svg';
//A few thousand fields of standard objects would take the page down rendered
//at once, they are shown a page at a time.
const ROWS_PER_PAGE = 300;

const STATUS_LABELS = {
    [DIFFERENT]: 'Different',
    [LEFT_ONLY]: 'Only left',
    [RIGHT_ONLY]: 'Only right',
    [IDENTICAL]: 'Identical'
};

const FILTERS = [
    { value: CHANGES, label: 'Changes', statuses: [DIFFERENT, LEFT_ONLY, RIGHT_ONLY] },
    { value: DIFFERENT, label: 'Different', statuses: [DIFFERENT] },
    { value: LEFT_ONLY, label: 'Only left', statuses: [LEFT_ONLY] },
    { value: RIGHT_ONLY, label: 'Only right', statuses: [RIGHT_ONLY] },
    { value: IDENTICAL, label: 'Identical', statuses: [IDENTICAL] },
    { value: ALL, label: 'All', statuses: [DIFFERENT, LEFT_ONLY, RIGHT_ONLY, IDENTICAL] }
];

//The components of a comparison by status. It opens on the changes, or on
//every component when nothing changed.
export default class CompareResults extends LightningElement{
    @api selectedPath;
    @api typeLabel = 'components';
    @api leftName = 'the left org';
    @api rightName = 'the right org';

    @api
    get entries(){
        return this._entries;
    }
    set entries(entries){
        this._entries = entries || [];
        const counts = countByStatus(this._entries);
        this.statusFilter = counts.all - counts[IDENTICAL] ? CHANGES : ALL;
        this.rowLimit = ROWS_PER_PAGE;
    }

    _entries = [];
    statusFilter = ALL;
    searchText = '';
    rowLimit = ROWS_PER_PAGE;
    searchIcon = SEARCH_ICON;

    connectedCallback(){
        adoptStyleSheet(css);
        adoptCompareTheme();
    }

    get counts(){
        return countByStatus(this._entries);
    }

    get changeCount(){
        return this.counts.all - this.counts[IDENTICAL];
    }

    get summaryMessage(){
        if(!this._entries.length){
            return 'Neither org holds any ' + this.typeLabel + '.';
        }

        if(!this.changeCount){
            return 'No differences: the ' + this._entries.length + ' ' + this.typeLabel + ' are identical in both orgs.';
        }

        return '';
    }

    get summaryClass(){
        return 'sfdl-compare-results__summary' + (this._entries.length ? ' sfdl-compare-results__summary_identical' : '');
    }

    get statusFilters(){
        const counts = this.counts;

        return FILTERS.map(filter => {
            const count = filter.statuses.reduce((total, status) => total + counts[status], 0);
            const isActive = filter.value === this.statusFilter;
            const statusClass = filter.statuses.length === 1 ? ' sfdl-status-badge sfdl-status-badge_' + filter.value : '';

            return {
                ...filter,
                count,
                ariaPressed: isActive ? 'true' : 'false',
                title: 'Show the ' + filter.label.toLowerCase() + ' ' + this.typeLabel,
                buttonClass: 'sfdl-status-filter' + statusClass + (isActive ? ' sfdl-status-filter_active' : '')
            };
        });
    }

    get searchWords(){
        return this.searchText.toLowerCase().split(/\s+/).filter(word => word);
    }

    get filteredEntries(){
        const statuses = FILTERS.find(filter => filter.value === this.statusFilter).statuses;
        const searchWords = this.searchWords;

        return this._entries.filter(entry =>
            statuses.includes(entry.status) &&
            searchWords.every(word => entry.path.toLowerCase().includes(word))
        );
    }

    get visibleRows(){
        return this.filteredEntries.slice(0, this.rowLimit).map(entry => {
            const slashIndex = entry.path.lastIndexOf('/');

            return {
                path: entry.path,
                folder: entry.path.slice(0, slashIndex + 1),
                fileName: entry.path.slice(slashIndex + 1),
                statusLabel: STATUS_LABELS[entry.status],
                title: entry.path + ': ' + this.statusTitle(entry.status),
                badgeClass: 'sfdl-status-badge sfdl-status-badge_' + entry.status,
                rowClass: 'sfdl-compare-results__row' + (entry.path === this.selectedPath ? ' sfdl-compare-results__row_selected' : '')
            };
        });
    }

    statusTitle(status){
        switch(status){
            case LEFT_ONLY:
                return 'only in ' + this.leftName;
            case RIGHT_ONLY:
                return 'only in ' + this.rightName;
            case DIFFERENT:
                return 'differs between both orgs';
            default:
                return 'identical in both orgs';
        }
    }

    get hasMoreRows(){
        return this.filteredEntries.length > this.rowLimit;
    }

    get showMoreLabel(){
        const remaining = this.filteredEntries.length - this.rowLimit;
        return 'Show ' + Math.min(remaining, ROWS_PER_PAGE) + ' more of the ' + remaining + ' left';
    }

    get emptyListMessage(){
        if(!this._entries.length || this.filteredEntries.length){
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

    handleRowClick(event){
        this.selectComponent(event.currentTarget.dataset.path);
    }

    selectComponent(path){
        this.dispatchEvent(new CustomEvent('componentselect', { detail: { path } }));
    }

    //Up and down open the previous and the next component.
    handleRowKeyDown(event){
        if(event.key !== 'ArrowDown' && event.key !== 'ArrowUp'){
            return;
        }

        event.preventDefault();

        const rows = [...this.template.querySelectorAll('.sfdl-compare-results__row')];
        const index = rows.indexOf(event.currentTarget);
        const nextRow = rows[(index + (event.key === 'ArrowDown' ? 1 : -1) + rows.length) % rows.length];

        nextRow.focus();
        this.selectComponent(nextRow.dataset.path);
    }
}
