import { LightningElement, api } from 'lwc';
import { LIMIT_ALERT_PERCENT } from 'sfdl/monitors';
import { matchesQuery } from 'sfdl/fuzzySearch';
import { LOADING, LOADED, FAILED } from 'sfdl/monitorCard';
import { adoptStyleSheet } from 'sfdl/styleSheets';
import { adoptCompareTheme } from 'sfdl/compareTheme';
import { css } from './monitorMetersCss';

const SEARCH_ICON = '/resources/searchGrey.svg';
const CLEAR_ICON = '/slds/icons/utility/close.svg';

//A monitor whose items carry a used and a max, drawn as meters rather than a
//card: every item on screen at once, the most used first as the monitor
//sorts them, the ones with nothing used kept behind a toggle, and a filter
//that finds one by its words, its API name or its aliases, mistyped or not.
//The monitor names it, the state carries the items.
export default class MonitorMeters extends LightningElement{
    //{ key, title, description, emptyMessage }, see sfdl/monitors.
    @api monitor;
    //{ status, items: [{ id, label, used, max, percent }], summary, error }.
    @api state;

    showsUnused = false;
    query = '';
    searchIcon = SEARCH_ICON;
    clearIcon = CLEAR_ICON;

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

    get status(){
        return this.state ? this.state.status : LOADING;
    }

    get isLoading(){
        return this.status === LOADING;
    }

    get isLoaded(){
        return this.status === LOADED;
    }

    get isError(){
        return this.status === FAILED;
    }

    get ariaBusy(){
        return this.isLoading ? 'true' : 'false';
    }

    get loadingLabel(){
        return 'Loading ' + this.title;
    }

    get error(){
        return this.state ? this.state.error : '';
    }

    get items(){
        return (this.state && this.state.items) || [];
    }

    get usedItems(){
        return this.items.filter(item => !item.isUnused);
    }

    get unusedItems(){
        return this.items.filter(item => item.isUnused);
    }

    get hasItems(){
        return this.items.length > 0;
    }

    get isFiltering(){
        return this.query.trim().length > 0;
    }

    //The ones not used come after every one in use, whatever their order. A
    //filter searches them all, what is looked for may well be one not used.
    get shownItems(){
        const inUse = this.usedItems;
        const items = this.showsUnused || this.isFiltering ? [...inUse, ...this.unusedItems] : inUse;

        return this.isFiltering ?
            items.filter(item => matchesQuery(this.query, [item.label, item.name, ...(item.aliases || [])])) :
            items;
    }

    get hasMeters(){
        return this.shownItems.length > 0;
    }

    get hasUnused(){
        return this.unusedItems.length > 0;
    }

    get showsUnusedToggle(){
        return this.hasUnused && !this.isFiltering;
    }

    get searchPlaceholder(){
        return 'Filter the limits';
    }

    get noMeterMessage(){
        return this.isFiltering ? 'No limit goes by "' + this.query.trim() + '"' : this.emptyMessage;
    }

    get unusedToggleLabel(){
        const count = this.unusedItems.length;
        return (this.showsUnused ? 'Hide the ' : 'Show the ') + count + (count === 1 ? ' limit' : ' limits') + ' not used';
    }

    get summary(){
        return (this.state && this.state.summary) || {};
    }

    get summaryLine(){
        if(!this.isLoaded){
            return this.description;
        }
        return this.usedItems.length + ' of ' + this.items.length + ' limits in use, the most used ' + this.summary.caption;
    }

    get severityLabel(){
        return this.summary.severityLabel;
    }

    get severityClass(){
        return 'sfdl-monitor-meters__severity sfdl-monitor-meters__severity_' + this.summary.severity;
    }

    get meters(){
        return this.shownItems.map(item => {
            const watched = item.percent >= LIMIT_ALERT_PERCENT;
            return {
                id: item.id,
                label: item.label || item.name,
                figure: item.used + ' of ' + item.max + ', ' + item.percent + '%',
                title: (item.label || item.name) + ': ' + item.used + ' of ' + item.max + ' (' + item.name + ')',
                className: 'sfdl-monitor-meters__meter' + (watched ? ' sfdl-monitor-meters__meter_alert' : ''),
                fillClass: 'sfdl-monitor-meters__fill' + (watched ? ' sfdl-monitor-meters__fill_alert' : ''),
                fillStyle: 'width:' + Math.min(100, Math.max(0, item.percent)) + '%;'
            };
        });
    }

    handleUnusedToggle(){
        this.showsUnused = !this.showsUnused;
    }

    handleQueryInput(event){
        this.query = event.target.value;
    }

    handleQueryKeyDown(event){
        if(event.key === 'Escape' && this.query){
            event.stopPropagation();
            this.handleQueryClear();
        }
    }

    handleQueryClear(){
        this.query = '';
        const input = this.template.querySelector('.sfdl-monitor-meters__search-input');
        if(input){
            input.value = '';
            input.focus();
        }
    }
}
