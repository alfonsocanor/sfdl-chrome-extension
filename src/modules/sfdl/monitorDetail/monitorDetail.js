import { LightningElement, api } from 'lwc';
import { saveAs } from 'file-saver';
import { groupItems, fillDays, formatDateTime, formatDay, dayOf, LIMIT_ALERT_PERCENT, DAY } from 'sfdl/monitors';
import { toCsv, toTsv } from 'sfdl/csv';
import { copyText, hasTextSelection, isPressKey } from 'sfdl/utils';
import { adoptStyleSheet } from 'sfdl/styleSheets';
import { adoptCompareTheme } from 'sfdl/compareTheme';
import { css } from './monitorDetailCss';

const BACK_ICON = '/slds/icons/utility/chevronleft.svg';
const SEARCH_ICON = '/resources/searchGrey.svg';
const CLEAR_ICON = '/slds/icons/utility/close.svg';
//Up to this many columns every day is labelled, past it one day a week and
//the last one.
const LABEL_EVERY_DAY_UP_TO = 16;
//A text longer than this is cut short in its cell, with a more to read it all.
export const LONG_TEXT = 60;
//The rows drawn at first and added by each show more, so a few thousand
//items do not all go into the page at once.
export const PAGE_ROWS = 200;
//The key of the group the folded ones go by, see groupItems.
const OTHER = 'other';
//How long the copy button says the rows were copied.
const COPIED_FOR = 2000;
const COPY_LABEL = 'Copy';

const isEmpty = value => value === undefined || value === null;

//How each kind of column turns a field into a cell.
const CELL_KINDS = {
    text: value => ({ text: isEmpty(value) ? '' : String(value) }),
    number: value => ({ text: isEmpty(value) ? '' : String(value), className: 'sfdl-monitor-detail__cell_number' }),
    date: value => ({ text: formatDateTime(value), title: value || '' }),
    day: value => ({ text: value ? formatDay(value) : '', title: value || '' }),
    meter: value => ({
        text: value + '%',
        isMeter: true,
        meterStyle: 'width:' + Math.min(100, Math.max(0, value)) + '%;',
        meterClass: 'sfdl-monitor-detail__meter-fill' + (value >= LIMIT_ALERT_PERCENT ? ' sfdl-monitor-detail__meter-fill_alert' : ''),
        className: 'sfdl-monitor-detail__cell_meter'
    })
};

function cellOf(column, item){
    const toCell = CELL_KINDS[column.kind] || CELL_KINDS.text;
    return toCell(item[column.key]);
}

//The detail of a monitor, as the monitor describes it: columns, breakdowns
//and row actions come from sfdl/monitors, the items from what it loaded. A
//word typed narrows the items, a bar clicked lists the items of its group
//only, and what is listed can be copied or saved as a CSV. Every word of it
//can be selected: a bar plays a button without being one.
export default class MonitorDetail extends LightningElement{
    @api monitor;
    @api summary;
    //The actions running, as row id|action key, drawn busy.
    @api runningActions = [];

    @api
    get items(){
        return this._items;
    }
    set items(items){
        this._items = items || [];
        this.expandedCells = [];
        this.selectedGroupKey = undefined;
        this.rowLimit = PAGE_ROWS;
    }

    _items = [];
    activeGroupingKey;
    //The key of the group whose bar was clicked, its items the only ones listed.
    selectedGroupKey;
    query = '';
    rowLimit = PAGE_ROWS;
    //The cells opened to their whole text, as row id|column key.
    expandedCells = [];
    backIcon = BACK_ICON;
    searchIcon = SEARCH_ICON;
    clearIcon = CLEAR_ICON;
    copyLabel = COPY_LABEL;

    connectedCallback(){
        adoptStyleSheet(css);
        adoptCompareTheme();
    }

    get title(){
        return this.monitor ? this.monitor.title : '';
    }

    get description(){
        return this.monitor ? this.monitor.description : '';
    }

    get emptyMessage(){
        return this.monitor ? this.monitor.emptyMessage : '';
    }

    get summaryLine(){
        if(!this.summary){
            return '';
        }
        return this.summary.value + ' ' + (this.summary.caption || '');
    }

    get columns(){
        return this.monitor ? this.monitor.columns : [];
    }

    get groupings(){
        return this.monitor ? this.monitor.groupings : [];
    }

    get actions(){
        return (this.monitor && this.monitor.actions) || [];
    }

    get hasActions(){
        return this.actions.length > 0;
    }

    get hasItems(){
        return this._items.length > 0;
    }

    get isFiltering(){
        return this.query.trim().length > 0;
    }

    //The items with the words typed in any of their cells, as shown or as
    //they are.
    get searchedItems(){
        const query = this.query.trim().toLowerCase();

        if(!query){
            return this._items;
        }

        return this._items.filter(item => this.columns.some(column => {
            const value = item[column.key];
            return cellOf(column, item).text.toLowerCase().includes(query) ||
                (!isEmpty(value) && String(value).toLowerCase().includes(query));
        }));
    }

    get hasBreakdown(){
        return this.hasItems && this.groupings.length > 0;
    }

    get activeGrouping(){
        return this.groupings.find(grouping => grouping.key === this.activeGroupingKey) || this.groupings[0];
    }

    get groupingOptions(){
        const active = this.activeGrouping;

        return this.groupings.map(grouping => {
            const pressed = active && grouping.key === active.key;
            return {
                key: grouping.key,
                label: grouping.label,
                pressed: pressed ? 'true' : 'false',
                className: 'slds-button sfdl-monitor-detail__grouping' + (pressed ? ' slds-button_brand' : ' slds-button_neutral')
            };
        });
    }

    get isTimeline(){
        const grouping = this.activeGrouping;
        return !!grouping && grouping.kind === DAY;
    }

    //The groups of the active breakdown over the items searched, as
    //groupItems counts them.
    get rawGroups(){
        const grouping = this.activeGrouping;
        return grouping ? groupItems(this.searchedItems, grouping) : [];
    }

    get hasSelection(){
        return this.selectedGroupKey !== undefined;
    }

    //A bar is pressed when its group is the one listed; the others fade
    //while one is.
    groupState(key){
        const pressed = key === this.selectedGroupKey;
        return {
            pressed: pressed ? 'true' : 'false',
            tabIndex: '0',
            stateClass: pressed ? ' sfdl-monitor-detail__group_selected' : this.hasSelection ? ' sfdl-monitor-detail__group_dimmed' : ''
        };
    }

    //The run of days, each a column as high as its share of the busiest day,
    //the count on its cap when it has one. A day with items lists them.
    get dayColumns(){
        const days = fillDays(this.rawGroups);
        const labelsEveryDay = days.length <= LABEL_EVERY_DAY_UP_TO;

        return days.map((day, index) => {
            const labelled = labelsEveryDay || index % 7 === 0 || index === days.length - 1;
            const state = this.groupState(day.key);
            return {
                ...day,
                ...state,
                style: 'height:' + day.percent + '%;',
                title: day.label + ': ' + day.count,
                countLabel: day.count ? String(day.count) : '',
                axisLabel: labelled ? day.label : '',
                isEmpty: !day.count,
                ariaDisabled: day.count ? 'false' : 'true',
                tabIndex: day.count ? '0' : '-1',
                className: 'sfdl-monitor-detail__day' + (day.count ? '' : ' sfdl-monitor-detail__day_empty') + state.stateClass
            };
        });
    }

    get groups(){
        return this.rawGroups.map(group => {
            const state = this.groupState(group.key);
            return {
                ...group,
                ...state,
                style: 'width:' + group.percent + '%;',
                title: group.label + ': ' + group.count,
                className: 'sfdl-monitor-detail__bar-row' + state.stateClass
            };
        });
    }

    //The items of the group picked, out of the items searched: the ones its
    //breakdown reads its key off, or for Other the ones folded into it.
    get shownItems(){
        const grouping = this.activeGrouping;
        const items = this.searchedItems;

        if(!grouping || !this.hasSelection){
            return items;
        }

        const kept = new Set(this.rawGroups.filter(group => group.key !== OTHER).map(group => group.key));
        const isOther = this.selectedGroupKey === OTHER;

        return items.filter(item => {
            const key = grouping.by(item) || 'Unknown';
            return isOther ? !kept.has(key) : key === this.selectedGroupKey;
        });
    }

    get selectionLabel(){
        const grouping = this.activeGrouping;
        const group = this.rawGroups.find(candidate => candidate.key === this.selectedGroupKey);
        const label = group ? group.label : grouping && grouping.format ? grouping.format(this.selectedGroupKey) : this.selectedGroupKey;
        return (grouping ? grouping.label + ': ' : '') + label;
    }

    get rowCountLabel(){
        const shown = this.shownItems.length;
        const total = this._items.length;
        const rows = total === 1 ? ' row' : ' rows';
        return shown === total ? total + rows : shown + ' of ' + total + rows;
    }

    get hasShownItems(){
        return this.shownItems.length > 0;
    }

    get hasNoShownItems(){
        return !this.hasShownItems;
    }

    get noMatchMessage(){
        return 'Nothing listed goes by what is filtered.';
    }

    get headers(){
        return this.columns.map(column => ({
            key: column.key,
            label: column.label,
            className: column.kind === 'number' ? 'sfdl-monitor-detail__cell_number' : ''
        }));
    }

    get hasMoreRows(){
        return this.shownItems.length > this.rowLimit;
    }

    get moreRowsLabel(){
        const left = this.shownItems.length - this.rowLimit;
        return 'Show ' + Math.min(left, PAGE_ROWS) + ' more of the ' + left + ' left';
    }

    get rows(){
        const running = this.runningActions || [];

        return this.shownItems.slice(0, this.rowLimit).map(item => ({
            id: item.id,
            className: item.isStuck ? 'sfdl-monitor-detail__row_alert' : '',
            cells: this.columns.map(column => {
                const cell = cellOf(column, item);
                const id = item.id + '|' + column.key;
                const isLong = !cell.isMeter && cell.text.length > LONG_TEXT;
                const isExpanded = isLong && this.expandedCells.includes(id);
                return {
                    key: column.key,
                    title: cell.text,
                    ...cell,
                    id,
                    isLong,
                    toggleLabel: isExpanded ? 'less' : 'more',
                    className: (cell.className || '') + (isExpanded ? ' sfdl-monitor-detail__cell_expanded' : '')
                };
            }),
            actions: this.actions.filter(action => !action.isAvailable || action.isAvailable(item)).map(action => {
                const isRunning = running.includes(item.id + '|' + action.key);
                return {
                    key: action.key,
                    label: isRunning ? action.busyLabel || action.label : action.label,
                    disabled: isRunning
                };
            })
        }));
    }

    handleToggleCell(event){
        const id = event.currentTarget.dataset.cell;

        this.expandedCells = this.expandedCells.includes(id) ?
            this.expandedCells.filter(cell => cell !== id) :
            [...this.expandedCells, id];
    }

    handleGroupingChange(event){
        this.activeGroupingKey = event.currentTarget.dataset.key;
        this.selectedGroupKey = undefined;
        this.rowLimit = PAGE_ROWS;
    }

    //A second click on the bar picked lists every item again. A click that
    //ends a selection of its words, or on an empty day, picks nothing.
    handleGroupSelect(event){
        if(!hasTextSelection()){
            this.selectGroup(event.currentTarget);
        }
    }

    handleGroupKeyDown(event){
        if(isPressKey(event)){
            event.preventDefault();
            this.selectGroup(event.currentTarget);
        }
    }

    selectGroup(target){
        const key = target.dataset.key;

        if(target.getAttribute('aria-disabled') === 'true'){
            return;
        }
        this.selectedGroupKey = key === this.selectedGroupKey ? undefined : key;
        this.rowLimit = PAGE_ROWS;
    }

    handleClearSelection(){
        this.selectedGroupKey = undefined;
        this.rowLimit = PAGE_ROWS;
    }

    handleQueryInput(event){
        this.query = event.target.value;
        this.rowLimit = PAGE_ROWS;
    }

    handleQueryKeyDown(event){
        if(event.key === 'Escape' && this.query){
            event.stopPropagation();
            this.handleQueryClear();
        }
    }

    handleQueryClear(){
        this.query = '';
        this.rowLimit = PAGE_ROWS;
        const input = this.template.querySelector('.sfdl-monitor-detail__search-input');
        if(input){
            input.value = '';
            input.focus();
        }
    }

    handleMoreRows(){
        this.rowLimit += PAGE_ROWS;
    }

    //What is listed, every row of it and not only the ones drawn, column for
    //column, the dates as the org wrote them.
    handleDownloadCsv(){
        const fileName = (this.monitor ? this.monitor.key : 'monitor') + '-' + dayOf(new Date().toISOString()) + '.csv';
        saveAs(new Blob([toCsv(this.columns, this.shownItems)], { type: 'text/csv;charset=utf-8' }), fileName);
    }

    //What is listed, as it reads on screen, a tab between the cells: ready to
    //paste into a spreadsheet or a message.
    async handleCopy(){
        const rows = this.shownItems.map(item => this.columns.map(column => cellOf(column, item).text));
        await copyText(toTsv(this.columns.map(column => column.label), rows));
        this.copyLabel = 'Copied';
        clearTimeout(this.copiedTimer);
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        this.copiedTimer = setTimeout(() => {
            this.copyLabel = COPY_LABEL;
        }, COPIED_FOR);
    }

    disconnectedCallback(){
        clearTimeout(this.copiedTimer);
    }

    handleAction(event){
        const { id, action } = event.currentTarget.dataset;
        this.dispatchEvent(new CustomEvent('action', { detail: { id, action } }));
    }

    handleBack(){
        this.dispatchEvent(new CustomEvent('back'));
    }
}
