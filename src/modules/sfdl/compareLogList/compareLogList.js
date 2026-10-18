/*global chrome*/
import { LightningElement, api } from 'lwc';
import { getApexLogs } from 'sfdl/salesforceConnection';
import { adoptStyleSheet } from 'sfdl/styleSheets';
import { adoptCompareTheme } from 'sfdl/compareTheme';
import { css } from './compareLogListCss';

const SEARCH_ICON = '/resources/searchGrey.svg';
const REFRESH_ICON = '/slds/icons/utility/refresh.svg';
const ROW_CLASS = 'sfdl-compare-log-row';

//The logs of one org, to pick the one to compare on the side the list feeds.
export default class CompareLogList extends LightningElement{
    //left or right, the side the list feeds.
    @api side = 'left';
    @api leftLogId;
    @api rightLogId;
    @api noSessionMessage = 'Pick an org to list its logs';

    @api
    get sessionInformation(){
        return this._sessionInformation;
    }
    set sessionInformation(sessionInformation){
        this._sessionInformation = sessionInformation;

        if(this.isComponentConnected && this.sessionKey !== this.loadedSessionKey){
            this.loadLogs();
        }
    }

    _sessionInformation;
    isComponentConnected = false;
    loadedSessionKey;
    loadSequence = 0;

    logs = [];
    filterText = '';
    isLoading = false;
    hasLoaded = false;
    errorMessage;

    searchIcon = SEARCH_ICON;
    refreshIcon = REFRESH_ICON;

    connectedCallback(){
        this.isComponentConnected = true;
        adoptStyleSheet(css);
        adoptCompareTheme();
        this.loadLogs();
    }

    disconnectedCallback(){
        this.isComponentConnected = false;
    }

    get hasSession(){
        return !!(this._sessionInformation && this._sessionInformation.instanceUrl && this._sessionInformation.authToken);
    }

    get sessionKey(){
        return this.hasSession ?
            [this._sessionInformation.instanceUrl, this._sessionInformation.authToken, this._sessionInformation.queryWhere || ''].join('|') :
            '';
    }

    get isFilterDisabled(){
        return !this.logs.length;
    }

    get isRefreshDisabled(){
        return !this.hasSession || this.isLoading;
    }

    get filterWords(){
        return this.filterText.toLowerCase().split(/\s+/).filter(word => word);
    }

    get visibleLogs(){
        const filterWords = this.filterWords;

        return this.logs
            .filter(log => filterWords.every(word => log.name.toLowerCase().includes(word)))
            .map(log => this.decorateLog(log));
    }

    decorateLog(log){
        const selectedLogId = this.side === 'right' ? this.rightLogId : this.leftLogId;
        const isSelected = log.id === selectedLogId;

        return {
            id: log.id,
            name: log.name,
            title: log.name + (isSelected ? ' (' + this.side + ')' : ''),
            rowClass: ROW_CLASS + (isSelected ? ' ' + ROW_CLASS + '_' + this.side : '')
        };
    }

    get countLabel(){
        if(!this.logs.length){
            return '';
        }

        const visibleCount = this.visibleLogs.length;
        const logsLabel = this.logs.length === 1 ? ' log' : ' logs';

        return visibleCount === this.logs.length ?
            this.logs.length + logsLabel :
            visibleCount + ' of ' + this.logs.length + logsLabel;
    }

    get message(){
        if(this.errorMessage){
            return this.errorMessage;
        }

        if(!this.hasSession){
            return this.noSessionMessage;
        }

        if(this.isLoading || !this.hasLoaded){
            return '';
        }

        if(!this.logs.length){
            return 'There are no logs in this org';
        }

        return this.visibleLogs.length ? '' : 'No log matches the filter';
    }

    get messageClass(){
        return 'sfdl-compare-log-list__message' + (this.errorMessage ? ' sfdl-compare-log-list__message_error' : '');
    }

    async loadLogs(){
        const sessionInformation = this._sessionInformation;
        const sequence = ++this.loadSequence;

        this.loadedSessionKey = this.sessionKey;
        this.errorMessage = undefined;

        if(!this.hasSession){
            this.logs = [];
            this.hasLoaded = false;
            this.isLoading = false;
            return;
        }

        this.isLoading = true;

        try{
            const apexLogRecords = await getApexLogs(sessionInformation);
            const { apexLogList } = await chrome.runtime.sendMessage({
                message: 'getApexLogList', apexLogList: apexLogRecords
            });

            //A newer load started while this one was on its way.
            if(sequence !== this.loadSequence){
                return;
            }

            this.logs = apexLogList || [];
        } catch(error){
            if(sequence !== this.loadSequence){
                return;
            }

            this.logs = [];
            this.errorMessage = error.message;
        }

        this.isLoading = false;
        this.hasLoaded = true;
    }

    handleRefresh(){
        this.loadLogs();
    }

    handleFilter(event){
        this.filterText = event.target.value;
    }

    getLog(logId){
        return this.logs.find(log => log.id === logId);
    }

    handleRowClick(event){
        this.selectLog(event.currentTarget.dataset.logid, this.side);
    }

    selectLog(logId, side){
        const log = this.getLog(logId);

        if(log){
            this.dispatchEvent(new CustomEvent('logselect', {
                detail: { log, side }
            }));
        }
    }

    //Up and down walk the list and compare every log they walk on, so a side
    //can be scanned against the other one log after the other.
    handleRowKeyDown(event){
        if(event.key !== 'ArrowDown' && event.key !== 'ArrowUp'){
            return;
        }

        event.preventDefault();

        const logButtons = [...this.template.querySelectorAll('.sfdl-compare-log-name')];
        const index = logButtons.indexOf(event.currentTarget);
        const nextButton = logButtons[(index + (event.key === 'ArrowDown' ? 1 : -1) + logButtons.length) % logButtons.length];

        nextButton.focus();
        this.selectLog(nextButton.dataset.logid, this.side);
    }
}
