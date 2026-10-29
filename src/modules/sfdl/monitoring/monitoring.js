import { LightningElement, api, track } from 'lwc';
import { MONITORS, METERS, LIVE, getSections, summarizeMonitor, isUnavailableError } from 'sfdl/monitors';
import { LOADING, LOADED, FAILED, UNAVAILABLE } from 'sfdl/monitorCard';
import { alertDialog, confirmDialog } from 'sfdl/utils';
import { adoptStyleSheet } from 'sfdl/styleSheets';
import { adoptCompareTheme } from 'sfdl/compareTheme';
import { css } from './monitoringCss';

const REFRESH_ICON = '/slds/icons/utility/refresh.svg';

//The Monitoring tab: the org picked, then the sections of the catalogue, a
//card per monitor under the title of its section and the limits as meters in
//a panel on the right, each loading on its own, and the detail of the card
//opened. The tab draws whatever sfdl/monitors lists, so adding a monitor
//there is enough.
export default class Monitoring extends LightningElement{
    //The orgs with a session, { label: url, value: token }.
    @api orgs = [];
    //The org of the log list, the one to start with.
    @api
    get sessionInformation(){
        return this._sessionInformation;
    }
    set sessionInformation(sessionInformation){
        this._sessionInformation = sessionInformation;
        if(!this.session && sessionInformation && sessionInformation.instanceUrl){
            this.pickOrg({ instanceUrl: sessionInformation.instanceUrl, authToken: sessionInformation.authToken });
        }
    }
    @api height;

    _sessionInformation;
    session;
    //The catalogue, each entry with the state of its card.
    @track cards = MONITORS.map(monitor => ({ key: monitor.key, monitor, state: { status: LOADING } }));
    openKey;
    //Counts the loads, so the answers of an org left behind are dropped.
    loadSequence = 0;
    //The row actions of the detail running, as row id|action key.
    runningActions = [];
    refreshIcon = REFRESH_ICON;

    connectedCallback(){
        adoptStyleSheet(css);
        adoptCompareTheme();
    }

    get containerStyle(){
        return this.height ? 'height:' + this.height + 'px;' : '';
    }

    get orgOptions(){
        return (this.orgs || []).map(org => ({ label: org.label, value: org.label }));
    }

    get orgUrl(){
        return this.session ? this.session.instanceUrl : undefined;
    }

    get hasOrg(){
        return !!this.session;
    }

    get isOrgBadgePulsing(){
        return !this.hasOrg;
    }

    get isRefreshDisabled(){
        return !this.hasOrg || this.cards.some(card => card.state.status === LOADING);
    }

    get openCard(){
        return this.openKey ? this.cards.find(card => card.key === this.openKey) : undefined;
    }

    //A monitor that listens rather than lists opens on the live view.
    get isLiveOpen(){
        const card = this.openCard;
        return !!card && card.monitor.view === LIVE;
    }

    //The sections stay in the tree under the detail, hidden.
    get sectionsClass(){
        return 'sfdl-monitoring__sections' + (this.openCard ? ' slds-hide' : '');
    }

    get sections(){
        const cardsByKey = new Map(this.cards.map(card => [card.key, card]));

        return getSections().map(section => ({
            key: section.key,
            title: section.title,
            isMeters: section.presentation === METERS,
            cards: section.monitors.map(monitor => cardsByKey.get(monitor.key)).filter(Boolean)
        }));
    }

    get cardSections(){
        return this.sections.filter(section => !section.isMeters);
    }

    get meterSections(){
        return this.sections.filter(section => section.isMeters);
    }

    get hint(){
        if(!this.hasOrg){
            return 'Pick an org, then open a card for the detail behind its figure.';
        }
        return this.openCard ?
            'Count the items by any breakdown, click a bar to list its items only, or go back to the cards.' :
            'Click a card for what is behind its figure. The refresh reads the org again.';
    }

    handleOrgChange(event){
        const org = (this.orgs || []).find(candidate => candidate.label === event.detail.value);

        if(org){
            this.pickOrg({ instanceUrl: org.label, authToken: org.value });
        }
    }

    pickOrg(session){
        this.session = session;
        this.openKey = undefined;
        this.loadAll();
    }

    handleRefresh(){
        this.loadAll();
    }

    loadAll(){
        if(!this.session){
            return;
        }

        const sequence = ++this.loadSequence;
        const session = this.session;

        this.cards = this.cards.map(card => ({ ...card, state: { status: LOADING } }));
        this.cards.forEach(card => this.loadCard(card.key, session, sequence));
    }

    async loadCard(key, session, sequence){
        const { monitor } = this.cards.find(card => card.key === key);
        let state;

        try{
            const loaded = await monitor.load(session);
            state = { status: LOADED, items: loaded.items, total: loaded.total, summary: summarizeMonitor(monitor, loaded) };
        } catch(error){
            //An org without the licence or the permission is told what the
            //monitor needs, in grey; anything else is an error.
            state = monitor.requires && isUnavailableError(error) ?
                { status: UNAVAILABLE, error: monitor.requires } :
                { status: FAILED, error: error.message };
        }

        if(sequence === this.loadSequence){
            this.cards = this.cards.map(card => (card.key === key ? { ...card, state } : card));
        }
    }

    handleOpen(event){
        this.openKey = event.detail.key;
    }

    handleBack(){
        this.openKey = undefined;
    }

    //A button of a row of the detail: the action of the open monitor runs on
    //its item with the org picked, once at a time per row, asked about first
    //when it changes the org, and tells why when it fails. A monitor whose
    //action changed what it reads is read again, its detail left open.
    async handleAction(event){
        const { id, action: actionKey } = event.detail;
        const card = this.openCard;
        const action = card && (card.monitor.actions || []).find(candidate => candidate.key === actionKey);
        const item = card && (card.state.items || []).find(candidate => candidate.id === id);
        const running = id + '|' + actionKey;
        const session = this.session;

        if(!action || !item || this.runningActions.includes(running)){
            return;
        }

        if(action.confirm && !(await confirmDialog(action.confirm(item)))){
            return;
        }

        this.runningActions = [...this.runningActions, running];

        try{
            await action.run(session, item);
            if(action.reloads && session === this.session){
                await this.loadCard(card.key, session, this.loadSequence);
            }
        } catch(error){
            alertDialog({ title: 'Could not ' + action.label.toLowerCase(), message: error.message });
        } finally {
            this.runningActions = this.runningActions.filter(key => key !== running);
        }
    }
}
