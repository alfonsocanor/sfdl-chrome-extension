import { LightningElement, api } from 'lwc';
import { StreamingClient, STOPPED, CONNECTING, LISTENING, FAILED } from 'sfdl/streaming';
import { MONITOR_API_VERSION, formatDateTime } from 'sfdl/monitors';
import { copyText, confirmDialog } from 'sfdl/utils';
import { adoptStyleSheet } from 'sfdl/styleSheets';
import { adoptCompareTheme } from 'sfdl/compareTheme';
import { css } from './liveEventsCss';

const BACK_ICON = '/slds/icons/utility/chevronleft.svg';
//The events kept on screen, the oldest let go past it.
export const MAX_EVENTS = 500;
//A payload longer than this on one line is cut short, with a more to read it.
const SHORT_PAYLOAD = 160;
const COPIED_FOR = 2000;
const COPY_LABEL = 'Copy all';
const MINUTE = 60 * 1000;
//What a monitor without its own listen settings gets.
const DEFAULT_LISTEN = { minutes: [5, 15, 30], defaultMinutes: 15, maxEvents: 1000, alertPercent: 80 };
//Why the last listening stopped by itself.
const BY_TIME = 'time';
const BY_EVENTS = 'events';
//Before listening starts, while the deliveries of the org are read.
const CHECKING = 'checking';

function pad(value){
    return String(value).padStart(2, '0');
}

//hh:mm of a time.
function formatTime(date){
    return pad(date.getHours()) + ':' + pad(date.getMinutes());
}

//'30 minutes', '1 hour', '2 hours'.
export function durationLabel(minutes){
    if(minutes % 60 === 0){
        const hours = minutes / 60;
        return hours + (hours === 1 ? ' hour' : ' hours');
    }
    return minutes + (minutes === 1 ? ' minute' : ' minutes');
}

function count(value){
    return Number(value).toLocaleString('en-US');
}

//The detail of a monitor whose view is live: the channels of the org it
//loaded to pick from, and the events of the one picked as they come, the
//newest first, each with its payload. Listening stops by itself after the
//time picked, at most what the monitor allows, and after the events the org
//can spare; on the way back, with another org, or with Stop.
export default class LiveEvents extends LightningElement{
    //{ title, description, emptyMessage, listen }, see sfdl/monitors.
    @api monitor;
    //The org listened to, { instanceUrl, authToken }.
    @api session;

    @api
    get channels(){
        return this._channels;
    }
    set channels(channels){
        this._channels = channels || [];
    }

    _channels = [];
    channel;
    //The minutes picked, the monitor's default until one is.
    pickedMinutes;
    status = STOPPED;
    error;
    since;
    stopsAt;
    stopReason;
    //What listening to the channel may take of the org, see listenBudget.
    budget;
    //Why listening did not start, when the org cannot spare it.
    notice;
    events = [];
    //The events opened to their whole payload, by key.
    expanded = [];
    eventCount = 0;
    //The events heard since the last start, against the cap.
    heardThisTime = 0;
    //The events one listening may hear, null for no cap but its time.
    cap = null;
    //The minutes the last listening was given, for its stopped line.
    minutesListened;
    startedAt;
    stopTimer;
    //Each start, so one that a stop or a later start overtook goes no further.
    startCount = 0;
    isDisconnected = false;
    copyLabel = COPY_LABEL;
    backIcon = BACK_ICON;

    connectedCallback(){
        adoptStyleSheet(css);
        adoptCompareTheme();
    }

    disconnectedCallback(){
        this.isDisconnected = true;
        this.startCount++;
        clearTimeout(this.copiedTimer);
        clearTimeout(this.stopTimer);
        if(this.client){
            this.client.stop();
        }
    }

    get listen(){
        return { ...DEFAULT_LISTEN, ...((this.monitor && this.monitor.listen) || {}) };
    }

    get title(){
        return this.monitor ? this.monitor.title : '';
    }

    get description(){
        return this.monitor ? this.monitor.description : '';
    }

    get hasChannels(){
        return this._channels.length > 0;
    }

    get emptyMessage(){
        return this.monitor ? this.monitor.emptyMessage : '';
    }

    //The channels under the header of their kind.
    get channelOptions(){
        return this._channels.map(channel => ({ label: channel.label + ' (' + channel.id + ')', value: channel.id, group: channel.kind }));
    }

    //The longest the monitor allows is the last of its minutes.
    get minutes(){
        const allowed = this.listen.minutes;
        const picked = Number(this.pickedMinutes || this.listen.defaultMinutes);
        return allowed.includes(picked) ? picked : allowed[allowed.length - 1];
    }

    get durationOptions(){
        return this.listen.minutes.map(minutes => ({ label: durationLabel(minutes), value: String(minutes) }));
    }

    get durationValue(){
        return String(this.minutes);
    }

    get isRunning(){
        return this.status === CHECKING || this.status === CONNECTING || this.status === LISTENING;
    }

    get isStartDisabled(){
        return !this.channel || this.isRunning;
    }

    get isStopDisabled(){
        return !this.isRunning;
    }

    get heardLabel(){
        return this.eventCount === 1 ? '1 event heard' : count(this.eventCount) + ' events heard';
    }

    //Until when, and after how many events, the listening goes on.
    get stopsLine(){
        const parts = [];
        if(this.stopsAt){
            parts.push('Stops by itself at ' + formatTime(this.stopsAt));
        }
        if(this.cap){
            parts.push('after ' + count(this.cap) + ' events');
        }
        return parts.length ? parts.join(' or ') + '.' : '';
    }

    get statusLine(){
        if(this.status === CHECKING){
            return 'Reading what the org can spare of its event deliveries…';
        }
        if(this.status === CONNECTING){
            return 'Connecting to ' + this.channel + '…';
        }
        if(this.status === LISTENING){
            return 'Listening to ' + this.channel + ' since ' + formatDateTime(this.since) + ', ' + this.heardLabel + '. ' + this.stopsLine;
        }
        if(this.status === FAILED){
            return 'Could not listen to ' + this.channel + ': ' + this.error;
        }
        if(this.notice){
            return this.notice;
        }
        if(this.stopReason === BY_TIME){
            return 'Stopped by itself after ' + durationLabel(this.minutesListened) + ', ' + this.heardLabel + '.';
        }
        if(this.stopReason === BY_EVENTS){
            return 'Stopped by itself after ' + count(this.cap) + ' events, to leave the rest of the org\'s daily event deliveries to its own subscribers.';
        }
        return this.eventCount ? 'Stopped, ' + this.heardLabel + '.' : 'Pick a channel and start listening. Only what happens from then on is heard.';
    }

    get statusClass(){
        return 'sfdl-live-events__status sfdl-live-events__status_' + (this.notice && this.status === STOPPED ? FAILED : this.status);
    }

    //What one listening costs the org, said before and while it listens.
    get budgetLine(){
        const budget = this.budget;

        if(!budget){
            return 'Platform and change events heard here count toward the event deliveries the org gets each day, shared with its own subscribers. Real-time streams do not.';
        }
        if(!budget.counted){
            return 'Real-time streams do not count toward the event deliveries of the org.';
        }
        if(budget.max){
            return 'Each event heard here counts toward the org\'s event deliveries: ' + count(budget.used) + ' of ' + count(budget.max) +
                ' used in the last 24 hours (' + budget.percent + '%).';
        }
        return 'Each event heard here counts toward the org\'s event deliveries.';
    }

    get hasEvents(){
        return this.events.length > 0;
    }

    get rows(){
        return this.events.map(event => {
            const isLong = event.payloadLine.length > SHORT_PAYLOAD;
            const isExpanded = this.expanded.includes(event.key);
            return {
                ...event,
                isLong,
                isExpanded,
                shortText: isLong ? event.payloadLine.slice(0, SHORT_PAYLOAD) + '…' : event.payloadLine,
                toggleLabel: isExpanded ? 'less' : 'more'
            };
        });
    }

    createClient(){
        return new StreamingClient(this.session, {
            apiVersion: MONITOR_API_VERSION,
            onEvent: event => this.addEvent(event),
            onStatus: ({ status, error }) => {
                this.status = status;
                this.error = error ? error.message : undefined;
                if(status === LISTENING){
                    this.since = new Date().toISOString();
                }
                if(status !== LISTENING && status !== CONNECTING){
                    clearTimeout(this.stopTimer);
                }
            }
        });
    }

    addEvent(event){
        this.eventCount++;
        this.heardThisTime++;
        const payload = event.payload === undefined ? {} : event.payload;
        const entry = {
            key: this.eventCount + '|' + (event.replayId === undefined ? '' : event.replayId),
            when: formatDateTime(event.createdDate || new Date().toISOString()),
            createdDate: event.createdDate,
            channel: event.channel,
            replayId: event.replayId === undefined ? '' : String(event.replayId),
            payloadLine: JSON.stringify(payload),
            payloadText: JSON.stringify(payload, null, 2),
            raw: event.raw
        };
        this.events = [entry, ...this.events].slice(0, MAX_EVENTS);

        if(this.cap && this.heardThisTime >= this.cap){
            this.stopBy(BY_EVENTS);
        }
    }

    handleChannelChange(event){
        this.channel = event.detail.value;
        if(this.isRunning){
            this.handleStart();
        }
    }

    //A time picked while listening counts from when listening started.
    handleDurationChange(event){
        this.pickedMinutes = Number(event.detail.value);
        if(this.isRunning && this.startedAt){
            this.scheduleStop();
        }
    }

    //Reads what the org can spare first: a channel whose events count toward
    //the deliveries of the org listens for a share of what is left, asks
    //first when most of it is used, and does not start with none left.
    async handleStart(){
        if(!this.channel || !this.session){
            return;
        }

        const channel = this._channels.find(candidate => candidate.id === this.channel);
        const listen = this.listen;
        const start = ++this.startCount;
        const overtaken = () => start !== this.startCount || this.isDisconnected;
        clearTimeout(this.stopTimer);
        if(this.client && this.client.isRunning){
            this.client.stop();
        }
        this.notice = undefined;
        this.stopReason = undefined;
        this.status = CHECKING;

        let budget;
        try{
            budget = listen.budget ? await listen.budget(this.session, channel) : undefined;
        } catch(error){
            budget = undefined;
        }
        if(overtaken()){
            return;
        }
        this.budget = budget;

        if(budget && budget.counted && budget.maxEvents === 0){
            this.status = STOPPED;
            this.notice = 'Not started: the org has ' + count(budget.remaining || 0) + ' event deliveries left in the last 24 hours, and its own subscribers need them.';
            return;
        }

        if(budget && budget.counted && budget.percent >= listen.alertPercent){
            const confirmed = await confirmDialog({
                title: 'Listen with ' + budget.percent + '% of the deliveries used?',
                message: 'The org has used ' + count(budget.used) + ' of its ' + count(budget.max) + ' event deliveries in the last 24 hours. Listening takes up to ' +
                    count(budget.maxEvents) + ' more, which its own subscribers will not get once the rest is gone.',
                confirmLabel: 'Listen',
                variant: 'destructive'
            });
            if(overtaken()){
                return;
            }
            if(!confirmed){
                this.status = STOPPED;
                return;
            }
        }

        //Not knowing what the org can spare, the cap of the monitor holds.
        this.cap = !budget ? listen.maxEvents : budget.counted ? budget.maxEvents || listen.maxEvents : null;
        this.heardThisTime = 0;
        this.startedAt = Date.now();
        this.scheduleStop();

        if(!this.client){
            this.client = this.createClient();
        }
        this.client.start(this.channel);
    }

    scheduleStop(){
        clearTimeout(this.stopTimer);
        const stopsAt = this.startedAt + this.minutes * MINUTE;
        this.stopsAt = new Date(stopsAt);
        this.minutesListened = this.minutes;
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        this.stopTimer = setTimeout(() => this.stopBy(BY_TIME), Math.max(0, stopsAt - Date.now()));
    }

    stopBy(reason){
        this.stopReason = reason;
        clearTimeout(this.stopTimer);
        if(this.client){
            this.client.stop();
        }
        this.status = STOPPED;
    }

    handleStop(){
        this.startCount++;
        this.stopReason = undefined;
        clearTimeout(this.stopTimer);
        if(this.client){
            this.client.stop();
        }
        this.status = STOPPED;
    }

    handleClear(){
        this.events = [];
        this.expanded = [];
        this.eventCount = 0;
    }

    handleToggle(event){
        const key = event.currentTarget.dataset.key;
        this.expanded = this.expanded.includes(key) ? this.expanded.filter(each => each !== key) : [...this.expanded, key];
    }

    //Every event on screen as the org sent it, the newest first.
    async handleCopy(){
        await copyText(JSON.stringify(this.events.map(event => event.raw), null, 2));
        this.copyLabel = 'Copied';
        clearTimeout(this.copiedTimer);
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        this.copiedTimer = setTimeout(() => {
            this.copyLabel = COPY_LABEL;
        }, COPIED_FOR);
    }

    handleBack(){
        this.dispatchEvent(new CustomEvent('back'));
    }
}
