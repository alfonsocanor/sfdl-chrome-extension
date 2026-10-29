import { queryAll, queryCount, getLimits, describeGlobal, getRecordNames, shortId, isPermissionError, updateRecord } from 'sfdl/salesforceConnection';
import { readEventLogRows, getEventLogFiles, downloadEventLogFile, DAILY } from 'sfdl/eventLogFiles';
import { readMetadata, updateMetadata, childElements, childText, escapeXml } from 'sfdl/metadataApi';

//THE MONITORS. What the Monitoring tab watches in an org, one entry each, and
//the tab draws them without knowing one from another. An entry says:
//  key, title, description: what the card reads.
//  section: the key of the section of the tab it is drawn in, see SECTIONS.
//  load(session): Promise<{ items, total }>, the rows of its detail and the
//      count they are taken out of.
//  summarize({ items, total }): { value, caption, severity }, the figure of
//      the card.
//  columns: [{ key, label, kind }], how the detail lists an item, each column
//      reading one field of it. kind is text, date, number or meter.
//  groupings: [{ key, label, by(item), format?(key), sort?, sum?, kind? }],
//      the breakdowns the detail offers, each reading one thing off an item
//      to count by, or to sum by. A grouping of kind DAY is drawn over the
//      run of days, the empty ones included. rest: 'drop' leaves out the
//      groups past MAX_BARS instead of folding them into Other, for a sum
//      that means nothing added up, an average.
//  emptyMessage: what the detail says with nothing to list.
//  requires: what the org needs for the monitor, said on its card when the
//      org does not have it: an object it does not know or a permission it
//      refuses. Without it, that is an error like any other.
//  actions: [{ key, label, busyLabel, run(session, item), isAvailable?(item),
//      confirm?(item), reloads? }], the buttons of each row of the detail:
//      shown on the rows isAvailable takes, asked about first with what
//      confirm gives ({ title, message, confirmLabel, variant }) when it
//      changes the org, and the monitor read again after when reloads.
//  view: LIVE for a monitor whose detail listens to the org rather than lists
//      what it loaded: its items are the channels to listen to.
//  listen: for a LIVE monitor, { minutes, defaultMinutes, maxEvents,
//      alertPercent, budget(session, channel) }, how long a listening may last
//      and what it may take of the org, see listenBudget.
//Adding a monitor is adding an entry here.

//The sections of the tab, in order. A section of meters draws each of its
//monitors as a strip of meters, one per item, the rest draw cards.
export const METERS = 'meters';
export const CARDS = 'cards';
export const LIVE = 'live';
export const SECTIONS = [
    { key: 'limits', title: 'Limits at the moment', presentation: METERS },
    { key: 'security', title: 'Security and access', presentation: CARDS },
    { key: 'realTime', title: 'Real-time events', presentation: CARDS },
    { key: 'apex', title: 'Apex and jobs', presentation: CARDS },
    { key: 'logFiles', title: 'Event log files', presentation: CARDS },
    { key: 'events', title: 'Platform events', presentation: CARDS },
    { key: 'flows', title: 'Flows', presentation: CARDS },
    { key: 'lightning', title: 'Lightning pages', presentation: CARDS }
];

export const CLEAR = 'clear';
export const ALERT = 'alert';
//Nothing wrong or right about the figure, it is there to be known.
export const INFO = 'info';
export const SEVERITY_LABELS = {
    [CLEAR]: 'All clear',
    [ALERT]: 'Needs a look',
    [INFO]: 'Overview'
};

//A breakdown draws this many bars at most, the rest folded into Other.
export const MAX_BARS = 10;
//A breakdown by day is drawn over the days from the first one with an item to
//today, this many days at most, the earlier ones left out.
export const DAY = 'day';
export const MAX_DAY_COLUMNS = 60;
//How far back the async jobs are read. Salesforce keeps them seven days.
export const RECENT_DAYS = 7;
//A limit used this far, in percent, is one to look at.
export const LIMIT_ALERT_PERCENT = 80;
//The version of the api the monitors read through. The console reads the logs
//through an older one; the views of the flows and the event bus carry fields
//that only newer versions know, FlowDefinitionView its trigger object among
//them, and every org of a release answers to the same versions.
export const MONITOR_API_VERSION = '60.0';
//How far back Threat Detection and the Lightning usage are read.
export const THREAT_DAYS = 30;
export const LIGHTNING_DAYS = 30;
//The rows a monitor lists at most where an org can hold many more.
export const MAX_ROWS = 2000;
//The event log files a monitor reads at most, and their bytes together, so
//opening the tab never pulls a busy org's whole week of logs.
//A week of daily files and the day it started.
export const MAX_LOG_FILES = RECENT_DAYS + 1;
export const MAX_LOG_BYTES = 20 * 1024 * 1024;
const API = { apiVersion: MONITOR_API_VERSION };
const TOOLING_API = { apiVersion: MONITOR_API_VERSION, tooling: true };

function pad(value){
    return String(value).padStart(2, '0');
}

//The local day of a timestamp, as yyyy-mm-dd, so days sort as text.
export function dayOf(iso){
    if(!iso){
        return '';
    }
    const date = new Date(iso);
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
}

export function formatDay(day){
    return day ? day.slice(8, 10) + '/' + day.slice(5, 7) : 'No date';
}

//dd/mm hh:mm, the way the log names read a date.
export function formatDateTime(iso){
    if(!iso){
        return '';
    }
    const date = new Date(iso);
    return pad(date.getDate()) + '/' + pad(date.getMonth() + 1) + ' ' + pad(date.getHours()) + ':' + pad(date.getMinutes());
}

//The kind of an error out of its message: what comes before the first colon,
//'System.NullPointerException' out of 'System.NullPointerException: Attempt...'.
export function errorKindOf(message){
    if(!message){
        return 'Unknown';
    }
    const [kind] = message.split(':');
    return kind.trim() || message;
}

export function severityOf(count){
    return count > 0 ? ALERT : CLEAR;
}

//An org without the feature a monitor reads: the object is not there, or the
//user may not read it.
export function isUnavailableError(error){
    return !!error && (error.errorCode === 'INVALID_TYPE' || isPermissionError(error));
}

function round1(value){
    return Math.round(value * 10) / 10;
}

function compareText(a, b){
    return a < b ? -1 : a > b ? 1 : 0;
}

//Counts the items by what the grouping reads off each one, or sums what its
//sum reads off each one, the biggest first unless the grouping sorts by key,
//the way days do. Past MAX_BARS groups the smallest fold into Other. Each
//group carries its share of the biggest one, in percent, for the length of
//its bar.
export function groupItems(items, grouping){
    const counts = new Map();

    items.forEach(item => {
        const key = grouping.by(item) || 'Unknown';
        const weight = grouping.sum ? grouping.sum(item) || 0 : 1;
        counts.set(key, (counts.get(key) || 0) + weight);
    });

    //A sum of fractions is rounded to a decimal, 0.1 + 0.2 reads 0.3.
    let groups = [...counts].map(([key, count]) => ({
        key,
        label: grouping.format ? grouping.format(key) : key,
        count: grouping.sum ? round1(count) : count
    }));

    groups.sort(grouping.sort === 'key' ?
        (a, b) => compareText(a.key, b.key) :
        (a, b) => b.count - a.count || compareText(a.key, b.key));

    //The days are not folded: fillDays draws them all, the empty ones too.
    if(groups.length > MAX_BARS && grouping.kind !== DAY && grouping.rest === 'drop'){
        groups = groups.slice(0, MAX_BARS);
    } else if(groups.length > MAX_BARS && grouping.kind !== DAY){
        const kept = groups.slice(0, MAX_BARS - 1);
        const folded = groups.slice(MAX_BARS - 1);
        const count = folded.reduce((sum, group) => sum + group.count, 0);
        groups = [...kept, { key: 'other', label: 'Other (' + folded.length + ')', count }];
    }

    const biggest = Math.max(1, ...groups.map(group => group.count));

    return groups.map(group => ({ ...group, percent: Math.round(group.count / biggest * 100) }));
}

function nextDay(day){
    const date = new Date(day + 'T00:00:00');
    date.setDate(date.getDate() + 1);
    return dayOf(date.toISOString());
}

//The groups of a breakdown by day spread over every day from the first one
//with an item to today, or to the last one with an item, a day without any
//counting 0, so a quiet day shows as such. Groups without a day are left
//out. Past MAX_DAY_COLUMNS days only the latest are kept. Each day carries
//its share of the busiest one, in percent, for the height of its column.
export function fillDays(groups){
    const dated = groups.filter(group => /^\d{4}-\d{2}-\d{2}$/.test(group.key));

    if(!dated.length){
        return [];
    }

    const countByDay = new Map(dated.map(group => [group.key, group.count]));
    const keys = dated.map(group => group.key).sort();
    const today = dayOf(new Date().toISOString());
    const last = keys[keys.length - 1] > today ? keys[keys.length - 1] : today;
    const days = [];

    for(let day = keys[0]; day <= last && days.length <= MAX_DAY_COLUMNS * 4; day = nextDay(day)){
        days.push({ key: day, label: formatDay(day), count: countByDay.get(day) || 0 });
    }

    const kept = days.slice(-MAX_DAY_COLUMNS);
    const biggest = Math.max(1, ...kept.map(day => day.count));

    return kept.map(day => ({ ...day, percent: Math.round(day.count / biggest * 100) }));
}

//The figure of a card out of what its monitor loaded.
export function summarizeMonitor(monitor, loaded){
    const summary = monitor.summarize(loaded);
    return { ...summary, severityLabel: SEVERITY_LABELS[summary.severity] };
}

function byDay(field, sum){
    return {
        key: 'day',
        label: 'By day',
        kind: DAY,
        by: item => dayOf(item[field]),
        format: formatDay,
        sort: 'key',
        ...(sum ? { sum } : {})
    };
}

function byField(key, label, field, sum){
    return { key, label, by: item => item[field], ...(sum ? { sum } : {}) };
}

//'1 policy', '2 policies', '3 logins'.
export function plural(count, noun){
    if(count === 1){
        return count + ' ' + noun;
    }
    return count + ' ' + (/[^aeiou]y$/.test(noun) ? noun.slice(0, -1) + 'ies' : noun + 's');
}

const of = (count, noun) => 'of ' + plural(count, noun);

//── Debug logs that ended in an error ──────────────────────────────────────
//Only the users with a trace flag write logs, so this reads what the org
//happened to log, and the Status of a log holds the exception it ended in.
const APEX_LOG_SOQL = 'SELECT Id, LastModifiedDate, LogLength, LogUser.Name, Operation, Status FROM ApexLog ORDER BY LastModifiedDate DESC';

export const failedLogs = {
    key: 'failedLogs',
    section: 'apex',
    title: 'Failed debug logs',
    description: 'Debug logs whose status is not Success: the exception their request ended in.',
    emptyMessage: 'Every debug log of the org ended in Success.',
    columns: [
        { key: 'when', label: 'When', kind: 'date' },
        { key: 'user', label: 'User' },
        { key: 'operation', label: 'Operation' },
        { key: 'status', label: 'Error' },
        { key: 'length', label: 'Bytes', kind: 'number' }
    ],
    groupings: [
        byDay('when'),
        byField('user', 'By user', 'user'),
        { key: 'error', label: 'By error', by: item => errorKindOf(item.status) },
        byField('operation', 'By operation', 'operation')
    ],
    async load(session){
        const logs = await queryAll(session, APEX_LOG_SOQL, TOOLING_API);
        const items = logs
            .filter(log => log.Status !== 'Success')
            .map(log => ({
                id: log.Id,
                when: log.LastModifiedDate,
                user: log.LogUser ? log.LogUser.Name : '',
                operation: log.Operation,
                status: log.Status,
                length: log.LogLength
            }));

        return { items, total: logs.length };
    },
    summarize({ items, total }){
        return {
            value: items.length,
            caption: of(total, 'debug log') + ' in the org',
            severity: severityOf(items.length)
        };
    }
};

//── Async Apex that failed ─────────────────────────────────────────────────
//Batch, queueable, future and scheduled Apex of the last days, the message
//of a failure in ExtendedStatus. The worker rows of a batch are left out,
//the batch itself tells of them.
const ASYNC_JOB_FIELDS = 'Id, ApexClass.Name, MethodName, JobType, Status, ExtendedStatus, NumberOfErrors, JobItemsProcessed, TotalJobItems, CreatedDate, CompletedDate, CreatedBy.Name';
const ASYNC_JOB_SCOPE = "FROM AsyncApexJob WHERE CreatedDate = LAST_N_DAYS:" + RECENT_DAYS + " AND JobType != 'BatchApexWorker'";

export const failedJobs = {
    key: 'failedJobs',
    section: 'apex',
    title: 'Failed async jobs',
    description: 'Batch, queueable, future and scheduled Apex that failed or had errors in the last ' + RECENT_DAYS + ' days.',
    emptyMessage: 'No async job failed in the last ' + RECENT_DAYS + ' days.',
    columns: [
        { key: 'when', label: 'When', kind: 'date' },
        { key: 'apexClass', label: 'Class' },
        { key: 'jobType', label: 'Type' },
        { key: 'user', label: 'Submitted by' },
        { key: 'status', label: 'Status' },
        { key: 'progress', label: 'Items' },
        { key: 'error', label: 'Error' }
    ],
    groupings: [
        byDay('when'),
        byField('apexClass', 'By class', 'apexClass'),
        byField('user', 'By user', 'user'),
        byField('jobType', 'By type', 'jobType')
    ],
    async load(session){
        const [jobs, total] = await Promise.all([
            queryAll(session, 'SELECT ' + ASYNC_JOB_FIELDS + ' ' + ASYNC_JOB_SCOPE + " AND (Status = 'Failed' OR NumberOfErrors > 0) ORDER BY CreatedDate DESC", API),
            queryCount(session, 'SELECT COUNT() ' + ASYNC_JOB_SCOPE, API)
        ]);
        const items = jobs.map(job => ({
            id: job.Id,
            when: job.CreatedDate,
            apexClass: (job.ApexClass ? job.ApexClass.Name : '') + (job.MethodName ? '.' + job.MethodName : ''),
            jobType: job.JobType,
            user: job.CreatedBy ? job.CreatedBy.Name : '',
            status: job.Status,
            progress: job.TotalJobItems ?
                job.JobItemsProcessed + ' of ' + job.TotalJobItems + ', ' + job.NumberOfErrors + ' failed' :
                '',
            error: job.ExtendedStatus || ''
        }));

        return { items, total };
    },
    summarize({ items, total }){
        return {
            value: items.length,
            caption: of(total, 'async job') + ' in the last ' + RECENT_DAYS + ' days',
            severity: severityOf(items.length)
        };
    }
};

//── Scheduled jobs ─────────────────────────────────────────────────────────
//Every CronTrigger of the org, the ones that are stuck first. The type of a
//job is a code, read here into words.
export const CRON_JOB_TYPES = {
    '0': 'Data export',
    '3': 'Dashboard refresh',
    '4': 'Analytic snapshot',
    '6': 'Scheduled flow',
    '7': 'Scheduled Apex',
    '8': 'Report run',
    '9': 'Batch job',
    'A': 'Reporting notification'
};
export const STUCK_CRON_STATES = ['ERROR', 'BLOCKED', 'PAUSED_BLOCKED'];
const CRON_SOQL = 'SELECT Id, CronJobDetail.Name, CronJobDetail.JobType, State, PreviousFireTime, NextFireTime, TimesTriggered, CreatedBy.Name FROM CronTrigger ORDER BY NextFireTime';

export function isStuckCronState(state){
    return STUCK_CRON_STATES.includes(state);
}

export const scheduledJobs = {
    key: 'scheduledJobs',
    section: 'apex',
    title: 'Scheduled jobs in error',
    description: 'Scheduled jobs whose trigger is in error or blocked, out of every job scheduled in the org.',
    emptyMessage: 'Nothing is scheduled in this org.',
    columns: [
        { key: 'name', label: 'Job' },
        { key: 'jobType', label: 'Type' },
        { key: 'state', label: 'State' },
        { key: 'previousFire', label: 'Last run', kind: 'date' },
        { key: 'nextFire', label: 'Next run', kind: 'date' },
        { key: 'timesTriggered', label: 'Runs', kind: 'number' },
        { key: 'user', label: 'Scheduled by' }
    ],
    groupings: [
        byField('state', 'By state', 'state'),
        byField('jobType', 'By type', 'jobType'),
        byField('user', 'By user', 'user')
    ],
    async load(session){
        const triggers = await queryAll(session, CRON_SOQL, API);
        const items = triggers
            .map(trigger => ({
                id: trigger.Id,
                name: trigger.CronJobDetail ? trigger.CronJobDetail.Name : '',
                jobType: CRON_JOB_TYPES[trigger.CronJobDetail && trigger.CronJobDetail.JobType] || 'Other',
                state: trigger.State,
                previousFire: trigger.PreviousFireTime,
                nextFire: trigger.NextFireTime,
                timesTriggered: trigger.TimesTriggered,
                user: trigger.CreatedBy ? trigger.CreatedBy.Name : '',
                isStuck: isStuckCronState(trigger.State)
            }))
            .sort((a, b) => Number(b.isStuck) - Number(a.isStuck));

        return { items, total: items.length };
    },
    summarize({ items, total }){
        const stuck = items.filter(item => item.isStuck).length;
        return {
            value: stuck,
            caption: of(total, 'scheduled job'),
            severity: severityOf(stuck)
        };
    }
};

//── Platform events: the subscribers ───────────────────────────────────────
//Every trigger and client subscribed to an event, where it is in the stream
//(its position against the tip of the event bus, the lag between them), its
//retries and the last error that stopped it. A suspended subscriber is a
//trigger that failed too many times.
export const STUCK_SUBSCRIBER_STATUSES = ['Suspended', 'Error'];

export function isStuckSubscriber(subscriber){
    return STUCK_SUBSCRIBER_STATUSES.includes(subscriber.Status) || !!subscriber.LastError;
}

export const eventSubscribers = {
    key: 'eventSubscribers',
    section: 'events',
    title: 'Event subscribers in trouble',
    description: 'Apex triggers and clients subscribed to platform events and change events: suspended, in error or holding a last error, out of every subscriber of the org. The lag is how far behind the tip of the event bus each one reads.',
    emptyMessage: 'Nothing subscribes to an event in this org.',
    columns: [
        { key: 'name', label: 'Subscriber' },
        { key: 'topic', label: 'Event' },
        { key: 'type', label: 'Type' },
        { key: 'status', label: 'Status' },
        { key: 'lag', label: 'Lag', kind: 'number' },
        { key: 'retries', label: 'Retries', kind: 'number' },
        { key: 'error', label: 'Last error' }
    ],
    groupings: [
        byField('status', 'By status', 'status'),
        byField('topic', 'By event', 'topic'),
        byField('type', 'By type', 'type')
    ],
    async load(session){
        const subscribers = await queryAll(session, 'SELECT ExternalId, Name, Topic, Type, Status, Position, Tip, Retries, LastError FROM EventBusSubscriber', API);
        const items = subscribers
            .map(subscriber => ({
                id: subscriber.ExternalId || subscriber.Name + '|' + subscriber.Topic,
                name: subscriber.Name,
                topic: subscriber.Topic,
                type: subscriber.Type,
                status: subscriber.Status,
                lag: Math.max(0, (subscriber.Tip || 0) - (subscriber.Position || 0)),
                retries: subscriber.Retries || 0,
                error: subscriber.LastError || '',
                isStuck: isStuckSubscriber(subscriber)
            }))
            .sort((a, b) => Number(b.isStuck) - Number(a.isStuck) || b.lag - a.lag);

        return { items, total: items.length };
    },
    summarize({ items, total }){
        const stuck = items.filter(item => item.isStuck).length;
        return {
            value: stuck,
            caption: of(total, 'subscriber'),
            severity: severityOf(stuck)
        };
    }
};

//── Platform events: the events and who listens ────────────────────────────
//The platform events the org defines or Salesforce ships, from the list of
//objects: an event is an object that cannot be queried and is named as one.
//Each with how many subscribers read it.
export function isPlatformEvent(sobject){
    const name = sobject.name || '';
    return !sobject.queryable && (
        name.endsWith('__e') ||
        (name.endsWith('Event') && !name.endsWith('ChangeEvent'))
    );
}

export const platformEvents = {
    key: 'platformEvents',
    section: 'events',
    title: 'Platform events defined',
    description: 'The platform events of the org, custom and standard, and how many triggers and clients subscribe to each. An event nobody subscribes to is published for no one.',
    emptyMessage: 'The org defines no platform event.',
    columns: [
        { key: 'label', label: 'Event' },
        { key: 'name', label: 'API name' },
        { key: 'kind', label: 'Kind' },
        { key: 'subscribers', label: 'Subscribers', kind: 'number' }
    ],
    groupings: [
        byField('kind', 'By kind', 'kind'),
        { key: 'subscribed', label: 'By subscription', by: item => (item.subscribers ? 'Subscribed' : 'No subscriber') }
    ],
    async load(session){
        const [described, subscribers] = await Promise.all([
            describeGlobal(session, MONITOR_API_VERSION),
            queryAll(session, 'SELECT Topic FROM EventBusSubscriber', API)
        ]);
        const subscribersByEvent = new Map();
        subscribers.forEach(subscriber => {
            subscribersByEvent.set(subscriber.Topic, (subscribersByEvent.get(subscriber.Topic) || 0) + 1);
        });
        const items = described.sobjects
            .filter(isPlatformEvent)
            .map(sobject => ({
                id: sobject.name,
                name: sobject.name,
                label: sobject.label,
                kind: sobject.custom ? 'Custom' : 'Standard',
                subscribers: subscribersByEvent.get(sobject.name) || 0
            }))
            .sort((a, b) => Number(b.kind === 'Custom') - Number(a.kind === 'Custom') || compareText(a.label, b.label));

        return { items, total: items.length };
    },
    summarize({ items }){
        const custom = items.filter(item => item.kind === 'Custom').length;
        const subscribed = items.filter(item => item.subscribers > 0).length;
        return {
            value: custom,
            caption: 'custom, ' + subscribed + ' of ' + items.length + ' events subscribed',
            severity: INFO
        };
    }
};

//── Platform events: how many went through ─────────────────────────────────
//What the org published and delivered in the last days, per day and per
//metric, the way the usage metrics of the event bus report it.
function daysAgo(days){
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

export const eventUsage = {
    key: 'eventUsage',
    section: 'events',
    title: 'Events delivered',
    description: 'Platform events delivered to subscribers in the last ' + RECENT_DAYS + ' days, out of the usage metrics of the event bus, with what was published.',
    emptyMessage: 'The event bus reports no usage for the last ' + RECENT_DAYS + ' days.',
    columns: [
        { key: 'from', label: 'From', kind: 'date' },
        { key: 'to', label: 'To', kind: 'date' },
        { key: 'metric', label: 'Metric' },
        { key: 'value', label: 'Events', kind: 'number' }
    ],
    groupings: [
        { key: 'day', label: 'By day', kind: DAY, by: item => dayOf(item.from), format: formatDay, sort: 'key', sum: item => item.value },
        { key: 'metric', label: 'By metric', by: item => item.metric, sum: item => item.value }
    ],
    async load(session){
        const metrics = await queryAll(session,
            'SELECT Name, StartDate, EndDate, Value FROM PlatformEventUsageMetric WHERE StartDate >= ' + daysAgo(RECENT_DAYS) + ' AND EndDate <= ' + daysAgo(0) + ' ORDER BY StartDate DESC', API);
        const items = metrics.map((metric, index) => ({
            id: metric.Name + '|' + metric.StartDate + '|' + index,
            from: metric.StartDate,
            to: metric.EndDate,
            metric: metric.Name,
            value: metric.Value || 0
        }));

        return { items, total: items.length };
    },
    summarize({ items }){
        const sum = name => items.filter(item => item.metric === name).reduce((total, item) => total + item.value, 0);
        return {
            value: sum('DELIVERED'),
            caption: 'delivered, ' + sum('PUBLISHED') + ' published in the last ' + RECENT_DAYS + ' days',
            severity: INFO
        };
    }
};

//── Flows: the interviews paused or failed ─────────────────────────────────
//The Paused and Failed Flow Interviews page of Setup: every interview waiting
//in the org, the ones that failed first. An error of a running flow is not
//kept anywhere a query reaches, only emailed and published as an event.
export const flowInterviews = {
    key: 'flowInterviews',
    section: 'flows',
    title: 'Failed flow interviews',
    description: 'Flow interviews that ended in error, out of every interview paused or waiting in the org. An error of a flow that was not paused is only emailed by Salesforce.',
    emptyMessage: 'No flow interview is paused or waiting in this org.',
    columns: [
        { key: 'when', label: 'Started', kind: 'date' },
        { key: 'flow', label: 'Flow' },
        { key: 'label', label: 'Interview' },
        { key: 'element', label: 'Element' },
        { key: 'status', label: 'Status' },
        { key: 'user', label: 'Started by' }
    ],
    groupings: [
        byDay('when'),
        byField('flow', 'By flow', 'flow'),
        byField('status', 'By status', 'status'),
        byField('user', 'By user', 'user')
    ],
    async load(session){
        const interviews = await queryAll(session, 'SELECT Id, Name, InterviewLabel, CurrentElement, PauseLabel, InterviewStatus, CreatedDate, CreatedBy.Name FROM FlowInterview ORDER BY CreatedDate DESC', API);
        const items = interviews
            .map(interview => ({
                id: interview.Id,
                when: interview.CreatedDate,
                flow: interview.Name,
                label: interview.InterviewLabel || interview.PauseLabel || '',
                element: interview.CurrentElement || '',
                status: interview.InterviewStatus,
                user: interview.CreatedBy ? interview.CreatedBy.Name : '',
                isStuck: interview.InterviewStatus === 'Error'
            }))
            .sort((a, b) => Number(b.isStuck) - Number(a.isStuck));

        return { items, total: items.length };
    },
    summarize({ items, total }){
        const failed = items.filter(item => item.isStuck).length;
        return {
            value: failed,
            caption: of(total, 'interview') + ' paused or waiting',
            severity: severityOf(failed)
        };
    }
};

//── Flows: the definitions ─────────────────────────────────────────────────
//Every flow of the org, as the Flows page of Setup lists them: its type,
//what triggers it, whether it is active and whether a version newer than the
//active one waits as a draft.
export const flows = {
    key: 'flows',
    section: 'flows',
    title: 'Flows with a newer draft',
    description: 'Flows whose latest version is not the active one, a draft waiting to be activated or an inactive flow, out of every flow of the org, by type and by what triggers them.',
    emptyMessage: 'The org has no flow.',
    columns: [
        { key: 'label', label: 'Flow' },
        { key: 'processType', label: 'Type' },
        { key: 'triggerType', label: 'Trigger' },
        { key: 'triggerObject', label: 'On' },
        { key: 'state', label: 'State' },
        { key: 'modifiedBy', label: 'Last modified by' },
        { key: 'modified', label: 'Modified', kind: 'date' }
    ],
    groupings: [
        byField('processType', 'By type', 'processType'),
        byField('triggerType', 'By trigger', 'triggerType'),
        byField('triggerObject', 'By object', 'triggerObject'),
        byField('state', 'By state', 'state'),
        byField('modifiedBy', 'By author', 'modifiedBy')
    ],
    async load(session){
        const definitions = await queryAll(session, 'SELECT ApiName, Label, ProcessType, TriggerType, TriggerObjectOrEventLabel, IsActive, ActiveVersionId, LatestVersionId, LastModifiedBy, LastModifiedDate FROM FlowDefinitionView ORDER BY Label', API);
        const items = definitions
            .map(definition => {
                const hasNewerDraft = !!definition.LatestVersionId && definition.LatestVersionId !== definition.ActiveVersionId;
                return {
                    id: definition.ApiName,
                    name: definition.ApiName,
                    label: definition.Label,
                    processType: definition.ProcessType,
                    triggerType: definition.TriggerType || 'None',
                    triggerObject: definition.TriggerObjectOrEventLabel || '',
                    state: !definition.IsActive ? 'Inactive' : hasNewerDraft ? 'Active, newer draft' : 'Active',
                    modifiedBy: definition.LastModifiedBy || '',
                    modified: definition.LastModifiedDate,
                    isStuck: hasNewerDraft
                };
            })
            .sort((a, b) => Number(b.isStuck) - Number(a.isStuck));

        return { items, total: items.length };
    },
    summarize({ items, total }){
        const drafts = items.filter(item => item.isStuck).length;
        return {
            value: drafts,
            caption: of(total, 'flow') + ', ' + items.filter(item => item.state === 'Inactive').length + ' inactive',
            severity: INFO
        };
    }
};

//── Limits of the org ──────────────────────────────────────────────────────
//Every limit the org reports at the moment, the most used first, each with
//its name in words. The ones not listed here read their name split.
export const LIMIT_LABELS = {
    DailyApiRequests: 'API requests today',
    DailyAsyncApexExecutions: 'Async Apex executions today',
    DailyAsyncApexTests: 'Async Apex tests today',
    DailyBulkApiBatches: 'Bulk API batches today',
    DailyBulkV2QueryFileStorageMB: 'Bulk API 2.0 query storage today, MB',
    DailyBulkV2QueryJobs: 'Bulk API 2.0 query jobs today',
    DailyDeliveredPlatformEvents: 'Platform events delivered today',
    DailyDurableGenericStreamingApiEvents: 'Generic streaming events today',
    DailyDurableStreamingApiEvents: 'Streaming API events today',
    DailyGenericStreamingApiEvents: 'Generic streaming events today, legacy',
    DailyStandardVolumePlatformEvents: 'Standard volume events today',
    DailyStreamingApiEvents: 'Streaming API events today, legacy',
    DailyWorkflowEmails: 'Workflow emails today',
    DailyFunctionsApiCallLimit: 'Functions API calls today',
    DailyScratchOrgs: 'Scratch orgs today',
    DailyEinsteinDataInsightsStoryCreation: 'Einstein data insights stories today',
    DailyEinsteinDiscoveryPredictAPICalls: 'Einstein Discovery predictions today',
    DailyEinsteinDiscoveryPredictionsByCDC: 'Einstein Discovery predictions by CDC today',
    DailyEinsteinDiscoveryOptimizationJobs: 'Einstein Discovery optimisation jobs today',
    DailyEinsteinDiscoveryStoryCreation: 'Einstein Discovery stories today',
    DailyAnalyticsDataflowJobExecutions: 'Analytics dataflow jobs today',
    DailyAnalyticsUploadedFilesSizeMB: 'Analytics uploaded files today, MB',
    DailyMetadataRetrievesWithDependencies: 'Metadata retrieves with dependencies today',
    HourlyPublishedPlatformEvents: 'Platform events published this hour',
    HourlyPublishedStandardVolumePlatformEvents: 'Standard volume events published this hour',
    HourlyAsyncReportRuns: 'Async report runs this hour',
    HourlySyncReportRuns: 'Sync report runs this hour',
    HourlyDashboardRefreshes: 'Dashboard refreshes this hour',
    HourlyDashboardResults: 'Dashboard results this hour',
    HourlyDashboardStatuses: 'Dashboard statuses this hour',
    HourlyODataCallout: 'OData callouts this hour',
    HourlyTimeBasedWorkflow: 'Time based workflow actions this hour',
    HourlyLongTermIdMapping: 'Long term id mappings this hour',
    HourlyShortTermIdMapping: 'Short term id mappings this hour',
    HourlyManagedContentPublicRequests: 'Managed content public requests this hour',
    HourlyElevateSyncReportRuns: 'Elevate sync report runs this hour',
    HourlyElevateAsyncReportRuns: 'Elevate async report runs this hour',
    MonthlyPlatformEventsUsageEntitlement: 'Platform events this month, entitlement',
    MonthlyEinsteinDiscoveryStoryCreation: 'Einstein Discovery stories this month',
    ConcurrentAsyncGetReportInstances: 'Concurrent async report instances',
    ConcurrentSyncReportRuns: 'Concurrent sync report runs',
    ConcurrentEinsteinDataInsightsStoryCreation: 'Concurrent Einstein data insights stories',
    ConcurrentEinsteinDiscoveryStoryCreation: 'Concurrent Einstein Discovery stories',
    DurableStreamingApiConcurrentClients: 'Streaming API concurrent clients',
    StreamingApiConcurrentClients: 'Streaming API concurrent clients, legacy',
    DataStorageMB: 'Data storage, MB',
    FileStorageMB: 'File storage, MB',
    MassEmail: 'Mass emails today',
    SingleEmail: 'Single emails today',
    PermissionSets: 'Permission sets',
    PrivateConnectOutboundCalloutHourlyLimitMB: 'Private Connect outbound callouts this hour, MB',
    PublishCallbacks: 'Publish callbacks',
    ActiveScratchOrgs: 'Active scratch orgs',
    Package2VersionCreates: 'Package versions created today',
    Package2VersionCreatesWithoutValidation: 'Package versions created without validation today',
    PlatformEventTriggersWithParallelProcessing: 'Event triggers with parallel processing',
    CdpAiInferenceApiCalls: 'Data Cloud AI inference API calls'
};

//Other words a limit is looked for by, beside its name and its words.
export const LIMIT_ALIASES = {
    DailyApiRequests: ['rest', 'soap', 'calls', 'api calls'],
    DailyAsyncApexExecutions: ['batch', 'queueable', 'future', 'jobs'],
    DailyAsyncApexTests: ['unit tests', 'test runs'],
    DailyBulkApiBatches: ['bulk', 'data loader'],
    DailyBulkV2QueryJobs: ['bulk', 'data loader'],
    DailyDeliveredPlatformEvents: ['pe', 'event bus', 'subscribers'],
    HourlyPublishedPlatformEvents: ['pe', 'event bus', 'publish'],
    DailyStandardVolumePlatformEvents: ['pe', 'event bus'],
    HourlyPublishedStandardVolumePlatformEvents: ['pe', 'event bus', 'publish'],
    MonthlyPlatformEventsUsageEntitlement: ['pe', 'event bus'],
    DailyDurableStreamingApiEvents: ['cometd', 'push topic', 'streaming'],
    DurableStreamingApiConcurrentClients: ['cometd', 'subscribers', 'streaming'],
    DailyWorkflowEmails: ['mail', 'alerts'],
    SingleEmail: ['mail', 'send email'],
    MassEmail: ['mail', 'send email'],
    DataStorageMB: ['db', 'database', 'records', 'rows', 'space'],
    FileStorageMB: ['files', 'attachments', 'documents', 'content', 'space'],
    PermissionSets: ['perms', 'permset', 'permissions'],
    DailyScratchOrgs: ['dev hub', 'sfdx'],
    ActiveScratchOrgs: ['dev hub', 'sfdx'],
    HourlyODataCallout: ['external objects', 'salesforce connect'],
    HourlyTimeBasedWorkflow: ['time triggers', 'workflow rules']
};

//'DailyApiRequests' reads 'Daily api requests' when no words are given.
export function limitLabel(name){
    return LIMIT_LABELS[name] || name.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2').replace(/^./, first => first.toUpperCase());
}

export const orgLimits = {
    key: 'orgLimits',
    section: 'limits',
    title: 'Every limit the org reports',
    description: 'How far the org is into each of its limits at the moment: API requests, async Apex, platform events published and delivered, streaming clients, emails, storage and the rest, the most used first.',
    emptyMessage: 'The org reports no limit.',
    columns: [
        { key: 'label', label: 'Limit' },
        { key: 'used', label: 'Used', kind: 'number' },
        { key: 'max', label: 'Of', kind: 'number' },
        { key: 'percent', label: 'Usage', kind: 'meter' }
    ],
    groupings: [],
    async load(session){
        const limits = await getLimits(session, MONITOR_API_VERSION);
        const items = Object.entries(limits)
            .filter(([, limit]) => limit && typeof limit.Max === 'number' && limit.Max > 0)
            .map(([name, limit]) => {
                const used = limit.Max - limit.Remaining;
                return {
                    id: name,
                    name,
                    label: limitLabel(name),
                    aliases: LIMIT_ALIASES[name] || [],
                    used,
                    max: limit.Max,
                    percent: Math.round(used / limit.Max * 100),
                    isUnused: used === 0
                };
            })
            //By the exact share used, not the rounded percent, so a limit barely
            //touched still comes before one not touched at all, then by what is
            //used, the ones with nothing used last.
            .sort((a, b) => (b.used / b.max) - (a.used / a.max) || b.used - a.used || compareText(a.name, b.name));

        return { items, total: items.length };
    },
    summarize({ items }){
        const [top] = items;

        if(!top){
            return { value: '0%', caption: 'No limit reported', severity: CLEAR };
        }

        const watched = items.filter(item => item.percent >= LIMIT_ALERT_PERCENT).length;

        return {
            value: top.percent + '%',
            caption: top.label + ', ' + top.used + ' of ' + top.max + (watched > 1 ? ', ' + watched + ' limits past ' + LIMIT_ALERT_PERCENT + '%' : ''),
            severity: watched ? ALERT : CLEAR
        };
    }
};

//── Security: the logins that failed ───────────────────────────────────────
//The Login History of the last days, the logins that did not end in Success
//with why. A few mistyped passwords are the normal run of things; a user or
//an IP failing again and again is one to look at, a password being guessed or
//an integration gone wrong. The history names its user by id only, and does
//not filter on its Status: the latest logins are read, the failed kept.
export const FAILED_LOGIN_ALERT = 5;
export const MAX_LOGINS = 10000;
const LOGIN_FIELDS = 'Id, UserId, LoginTime, LoginType, Status, SourceIp, Application, Browser, Platform, CountryIso';
const REPEATED_LOGIN_FIELDS = ['user', 'sourceIp'];

const nameOf = (names, id) => names.get(shortId(id)) || id || '';

//The items whose user or IP failed FAILED_LOGIN_ALERT times or more, marked.
function markRepeatedFailures(items){
    const failures = new Map();

    items.forEach(item => REPEATED_LOGIN_FIELDS.forEach(field => {
        if(item[field]){
            const key = field + '|' + item[field];
            failures.set(key, (failures.get(key) || 0) + 1);
        }
    }));

    return items.map(item => ({
        ...item,
        isStuck: REPEATED_LOGIN_FIELDS.some(field => (failures.get(field + '|' + item[field]) || 0) >= FAILED_LOGIN_ALERT)
    }));
}

export const failedLogins = {
    key: 'failedLogins',
    section: 'security',
    title: 'Failed logins',
    description: 'Logins of the last ' + RECENT_DAYS + ' days that did not succeed and why: a wrong password, a user locked out or frozen, an IP out of range. A user or an IP failing ' + FAILED_LOGIN_ALERT + ' times or more is marked, out of every login of the org.',
    emptyMessage: 'Every login of the last ' + RECENT_DAYS + ' days succeeded.',
    columns: [
        { key: 'when', label: 'When', kind: 'date' },
        { key: 'user', label: 'User' },
        { key: 'status', label: 'Why' },
        { key: 'loginType', label: 'Type' },
        { key: 'application', label: 'Application' },
        { key: 'sourceIp', label: 'IP' },
        { key: 'country', label: 'Country' },
        { key: 'browser', label: 'Browser' }
    ],
    groupings: [
        byDay('when'),
        byField('status', 'By reason', 'status'),
        byField('user', 'By user', 'user'),
        byField('sourceIp', 'By IP', 'sourceIp'),
        byField('application', 'By application', 'application')
    ],
    async load(session){
        const scope = 'FROM LoginHistory WHERE LoginTime = LAST_N_DAYS:' + RECENT_DAYS;
        const [logins, total] = await Promise.all([
            queryAll(session, 'SELECT ' + LOGIN_FIELDS + ' ' + scope + ' ORDER BY LoginTime DESC LIMIT ' + MAX_LOGINS, API),
            queryCount(session, 'SELECT COUNT() ' + scope, API)
        ]);
        const failed = logins.filter(login => login.Status !== 'Success');
        const names = await getRecordNames(session, 'User', failed.map(login => login.UserId), API);
        const items = markRepeatedFailures(failed.map(login => ({
            id: login.Id,
            when: login.LoginTime,
            user: nameOf(names, login.UserId),
            status: login.Status,
            loginType: login.LoginType || '',
            application: login.Application || '',
            sourceIp: login.SourceIp || '',
            country: login.CountryIso || '',
            browser: [login.Browser, login.Platform].filter(Boolean).join(', ')
        })));

        return { items, total, read: logins.length };
    },
    summarize({ items, total, read }){
        const repeated = items.filter(item => item.isStuck).length;
        return {
            value: items.length,
            caption: of(total, 'login') + ' in the last ' + RECENT_DAYS + ' days' +
                (read < total ? ', the latest ' + read + ' read' : '') +
                (repeated ? ', ' + repeated + ' from a user or IP failing again and again' : ''),
            severity: repeated ? ALERT : items.length ? INFO : CLEAR
        };
    }
};

//── Security: what changed in Setup ────────────────────────────────────────
//The Setup Audit Trail of the last days. A change made by someone logged in
//as another user carries who did it, and is marked.
export const setupChanges = {
    key: 'setupChanges',
    section: 'security',
    title: 'Setup changes',
    description: 'What was changed in Setup in the last ' + RECENT_DAYS + ' days and by whom, as the Setup Audit Trail records it. A change made through Login-As is marked with who really made it.',
    emptyMessage: 'Nothing was changed in Setup in the last ' + RECENT_DAYS + ' days.',
    columns: [
        { key: 'when', label: 'When', kind: 'date' },
        { key: 'user', label: 'By' },
        { key: 'section', label: 'Section' },
        { key: 'change', label: 'Change' },
        { key: 'delegate', label: 'Login-As by' }
    ],
    groupings: [
        byDay('when'),
        byField('user', 'By user', 'user'),
        byField('section', 'By section', 'section'),
        byField('action', 'By action', 'action')
    ],
    async load(session){
        const changes = await queryAll(session,
            'SELECT Id, Action, Section, Display, CreatedDate, CreatedBy.Name, DelegateUser FROM SetupAuditTrail WHERE CreatedDate = LAST_N_DAYS:' + RECENT_DAYS + ' ORDER BY CreatedDate DESC LIMIT ' + MAX_ROWS, API);
        const items = changes.map(change => ({
            id: change.Id,
            when: change.CreatedDate,
            user: change.CreatedBy ? change.CreatedBy.Name : '',
            section: change.Section || '',
            action: change.Action || '',
            change: change.Display || change.Action || '',
            delegate: change.DelegateUser || '',
            isStuck: !!change.DelegateUser
        }));

        return { items, total: items.length };
    },
    summarize({ items }){
        const delegated = items.filter(item => item.isStuck).length;
        return {
            value: items.length,
            caption: 'in the last ' + RECENT_DAYS + ' days' + (delegated ? ', ' + delegated + ' through Login-As' : ''),
            severity: INFO
        };
    }
};

//── Security: what Threat Detection caught ─────────────────────────────────
//The stores of the Threat Detection events, each its own object. An org has
//the ones its licence brings, a store it does not know is passed over, and
//an org that knows none has no Threat Detection.
export const THREAT_STORES = [
    { name: 'SessionHijackingEventStore', label: 'Session hijacking' },
    { name: 'CredentialStuffingEventStore', label: 'Credential stuffing' },
    { name: 'ReportAnomalyEventStore', label: 'Report anomaly' },
    { name: 'ApiAnomalyEventStore', label: 'API anomaly' }
];
const THREAT_FIELDS = 'Id, EventIdentifier, EventDate, Username, Score, SourceIp, Summary';

export const threatDetection = {
    key: 'threatDetection',
    section: 'security',
    title: 'Threats detected',
    description: 'What Threat Detection caught in the last ' + THREAT_DAYS + ' days: sessions hijacked, credentials stuffed, reports run and API calls far from the habits of their user, each with its score and what it saw.',
    emptyMessage: 'Threat Detection caught nothing in the last ' + THREAT_DAYS + ' days.',
    requires: 'Threat Detection comes with Shield or the Event Monitoring add-on, read with the View Threat Detection Events permission.',
    columns: [
        { key: 'when', label: 'When', kind: 'date' },
        { key: 'threat', label: 'Threat' },
        { key: 'user', label: 'User' },
        { key: 'score', label: 'Score', kind: 'number' },
        { key: 'sourceIp', label: 'IP' },
        { key: 'summary', label: 'What it saw' }
    ],
    groupings: [
        byDay('when'),
        byField('threat', 'By threat', 'threat'),
        byField('user', 'By user', 'user'),
        byField('sourceIp', 'By IP', 'sourceIp')
    ],
    async load(session){
        const answers = await Promise.all(THREAT_STORES.map(store =>
            queryAll(session, 'SELECT ' + THREAT_FIELDS + ' FROM ' + store.name + ' WHERE EventDate = LAST_N_DAYS:' + THREAT_DAYS + ' ORDER BY EventDate DESC LIMIT ' + MAX_ROWS, API)
                .then(records => ({ store, records }), error => ({ store, error }))
        ));
        const broken = answers.find(answer => answer.error && !isUnavailableError(answer.error));
        const found = answers.filter(answer => !answer.error);

        if(broken){
            throw broken.error;
        }
        if(!found.length){
            throw answers[0].error;
        }

        const items = [].concat(...found.map(({ store, records }) => records.map(record => ({
            id: record.Id || record.EventIdentifier,
            when: record.EventDate,
            threat: store.label,
            user: record.Username || '',
            score: record.Score,
            sourceIp: record.SourceIp || '',
            summary: record.Summary || ''
        })))).sort((a, b) => compareText(b.when || '', a.when || ''));

        return { items, total: items.length };
    },
    summarize({ items }){
        return {
            value: items.length,
            caption: (items.length === 1 ? 'threat' : 'threats') + ' in the last ' + THREAT_DAYS + ' days',
            severity: severityOf(items.length)
        };
    }
};

//── Security: the Transaction Security policies ────────────────────────────
//What the org blocks, challenges or is told of as it happens. Read, not
//edited: they are written in Setup.
export const POLICY_KINDS = {
    CustomApexPolicy: 'Apex',
    CustomConditionBuilderPolicy: 'Condition builder'
};
export const ENABLED_POLICY = 'Enabled';
export const DISABLED_POLICY = 'Disabled';

function setPolicyState(session, item, state){
    return updateRecord(session, 'TransactionSecurityPolicy', item.id, { State: state }, API);
}
//The label field of a policy is named so in the API, not a word picked here.
// eslint-disable-next-line inclusive-language/use-inclusive-words
const POLICY_SOQL = 'SELECT Id, DeveloperName, MasterLabel, State, Type, EventName, LastModifiedDate, LastModifiedBy.Name FROM TransactionSecurityPolicy ORDER BY MasterLabel';

export const securityPolicies = {
    key: 'securityPolicies',
    section: 'security',
    title: 'Transaction security policies',
    description: 'The Transaction Security policies of the org: the real time event each one watches, how it is written and whether it is enabled to block, ask for MFA or notify.',
    emptyMessage: 'The org has no Transaction Security policy.',
    requires: 'Transaction Security comes with Shield or the Event Monitoring add-on.',
    columns: [
        { key: 'label', label: 'Policy' },
        { key: 'event', label: 'Event' },
        { key: 'kind', label: 'Written as' },
        { key: 'state', label: 'State' },
        { key: 'modifiedBy', label: 'Last modified by' },
        { key: 'modified', label: 'Modified', kind: 'date' }
    ],
    groupings: [
        byField('event', 'By event', 'event'),
        byField('state', 'By state', 'state'),
        byField('kind', 'By kind', 'kind')
    ],
    actions: [
        {
            key: 'enable',
            label: 'Enable',
            busyLabel: 'Enabling',
            reloads: true,
            isAvailable: item => item.state !== ENABLED_POLICY,
            confirm: item => ({
                title: 'Enable ' + item.label + '?',
                message: 'The policy acts at once on every ' + (item.event || 'event') + ' of the org, blocking, asking for MFA or notifying as it is written.',
                confirmLabel: 'Enable',
                variant: 'destructive'
            }),
            run: (session, item) => setPolicyState(session, item, ENABLED_POLICY)
        },
        {
            key: 'disable',
            label: 'Disable',
            busyLabel: 'Disabling',
            reloads: true,
            isAvailable: item => item.state === ENABLED_POLICY,
            confirm: item => ({
                title: 'Disable ' + item.label + '?',
                message: 'The org stops checking ' + (item.event || 'the event') + ' against this policy until it is enabled again.',
                confirmLabel: 'Disable',
                variant: 'destructive'
            }),
            run: (session, item) => setPolicyState(session, item, DISABLED_POLICY)
        }
    ],
    async load(session){
        const policies = await queryAll(session, POLICY_SOQL, API);
        const items = policies
            .map(policy => ({
                id: policy.Id,
                name: policy.DeveloperName,
                // eslint-disable-next-line inclusive-language/use-inclusive-words
                label: policy.MasterLabel || policy.DeveloperName,
                event: policy.EventName || '',
                kind: POLICY_KINDS[policy.Type] || policy.Type || '',
                state: policy.State || '',
                modifiedBy: policy.LastModifiedBy ? policy.LastModifiedBy.Name : '',
                modified: policy.LastModifiedDate
            }))
            .sort((a, b) => Number(b.state === ENABLED_POLICY) - Number(a.state === ENABLED_POLICY));

        return { items, total: items.length };
    },
    summarize({ items }){
        return {
            value: items.filter(item => item.state === ENABLED_POLICY).length,
            caption: 'enabled, ' + of(items.length, 'policy'),
            severity: INFO
        };
    }
};

//── Real-time events: the Event Manager ────────────────────────────────────
//The real-time event settings of the org, as Setup's Event Manager shows
//them: each event's streaming, its Stream entity, and its storage, the event
//itself, on or off. Every org lists the login and logout streams, the rest
//come with the add-on. Turning one on or off changes the org at once.
export const REAL_TIME_SETTINGS = { type: 'RealTimeEventSettings', fullName: 'RealTimeEvent' };
export const STREAMING = 'Streaming';
export const STORAGE = 'Storage';

//'LoginEventStream' reads 'Login event', 'ApiAnomalyEventStore' 'Api anomaly event'.
export function realTimeEventLabel(entityName){
    const words = String(entityName || '')
        .replace(/(Stream|Store)$/, '')
        .replace(/([a-z\d])([A-Z])/g, '$1 $2')
        .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
        .toLowerCase();
    return words.charAt(0).toUpperCase() + words.slice(1);
}

function setRealTimeEvent(session, item, isEnabled){
    return updateMetadata(session, MONITOR_API_VERSION, REAL_TIME_SETTINGS.type,
        '<met:fullName>' + REAL_TIME_SETTINGS.fullName + '</met:fullName>' +
        '<met:realTimeEvents>' +
        '<met:entityName>' + escapeXml(item.entity) + '</met:entityName>' +
        '<met:isEnabled>' + isEnabled + '</met:isEnabled>' +
        '</met:realTimeEvents>');
}

export const realTimeEvents = {
    key: 'realTimeEvents',
    section: 'realTime',
    title: 'Event Manager',
    description: 'The real-time events of the org as the Event Manager of Setup lists them, the streaming of each and its storage, on or off, to turn on or off from here. A stream turned on can be listened to in Live events.',
    emptyMessage: 'The org lists no real-time event.',
    requires: 'The real-time event settings are read through the Metadata API, with the Customize Application permission.',
    columns: [
        { key: 'event', label: 'Event' },
        { key: 'capability', label: 'Capability' },
        { key: 'state', label: 'State' },
        { key: 'entity', label: 'Entity' }
    ],
    groupings: [
        byField('state', 'By state', 'state'),
        byField('capability', 'By capability', 'capability')
    ],
    actions: [
        {
            key: 'turnOn',
            label: 'Turn on',
            busyLabel: 'Turning on',
            reloads: true,
            isAvailable: item => !item.isEnabled,
            confirm: item => ({
                title: 'Turn on the ' + item.capability.toLowerCase() + ' of ' + item.event + '?',
                message: item.capability === STREAMING ?
                    'The org starts publishing every ' + item.event.toLowerCase() + ' on its stream, for any subscriber to read.' :
                    'The org starts keeping every ' + item.event.toLowerCase() + ', to query later.',
                confirmLabel: 'Turn on',
                variant: 'destructive'
            }),
            run: (session, item) => setRealTimeEvent(session, item, true)
        },
        {
            key: 'turnOff',
            label: 'Turn off',
            busyLabel: 'Turning off',
            reloads: true,
            isAvailable: item => item.isEnabled,
            confirm: item => ({
                title: 'Turn off the ' + item.capability.toLowerCase() + ' of ' + item.event + '?',
                message: item.capability === STREAMING ?
                    'The org stops publishing ' + item.event.toLowerCase() + 's, and what subscribes to them hears nothing more.' :
                    'The org stops keeping ' + item.event.toLowerCase() + 's from now on.',
                confirmLabel: 'Turn off',
                variant: 'destructive'
            }),
            run: (session, item) => setRealTimeEvent(session, item, false)
        }
    ],
    async load(session){
        const [settings] = await readMetadata(session, MONITOR_API_VERSION, REAL_TIME_SETTINGS.type, [REAL_TIME_SETTINGS.fullName]);
        const items = (settings ? childElements(settings, 'realTimeEvents') : [])
            .map(setting => {
                const entity = childText(setting, 'entityName') || '';
                const isEnabled = childText(setting, 'isEnabled') === 'true';
                return {
                    id: entity,
                    entity,
                    event: realTimeEventLabel(entity),
                    capability: /Stream$/.test(entity) ? STREAMING : STORAGE,
                    state: isEnabled ? 'On' : 'Off',
                    isEnabled
                };
            })
            .sort((a, b) => Number(b.isEnabled) - Number(a.isEnabled) || compareText(a.event, b.event) || compareText(a.capability, b.capability));

        return { items, total: items.length };
    },
    summarize({ items }){
        return {
            value: items.filter(item => item.isEnabled).length,
            caption: 'on, ' + of(items.length, 'setting'),
            severity: INFO
        };
    }
};

//── Real-time events: listening ────────────────────────────────────────────
//Every channel of the org to listen to, out of the list of its objects: the
//platform events, the change events and the real-time event streams. The
//detail listens to the one picked, see sfdl/liveEvents.
export const PLATFORM_EVENT_CHANNEL = 'Platform event';
export const CHANGE_EVENT_CHANNEL = 'Change event';
export const REAL_TIME_CHANNEL = 'Real-time stream';
export const ALL_CHANGES_CHANNEL = '/data/ChangeEvents';

export function channelsOf(sobjects){
    const channels = [];

    sobjects.forEach(sobject => {
        const name = sobject.name || '';
        if(name.endsWith('EventStream')){
            channels.push({ id: '/event/' + name, name, label: sobject.label || name, kind: REAL_TIME_CHANNEL });
        } else if(isPlatformEvent(sobject)){
            channels.push({ id: '/event/' + name, name, label: sobject.label || name, kind: PLATFORM_EVENT_CHANNEL });
        } else if(name.endsWith('ChangeEvent')){
            channels.push({ id: '/data/' + name, name, label: sobject.label || name, kind: CHANGE_EVENT_CHANNEL });
        }
    });

    if(channels.some(channel => channel.kind === CHANGE_EVENT_CHANNEL)){
        channels.push({ id: ALL_CHANGES_CHANNEL, name: 'ChangeEvents', label: 'Every change event', kind: CHANGE_EVENT_CHANNEL });
    }

    const order = [REAL_TIME_CHANNEL, PLATFORM_EVENT_CHANNEL, CHANGE_EVENT_CHANNEL];
    return channels.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind) || compareText(a.label, b.label));
}

//How long one listening lasts, picked from these minutes, and how many
//platform or change events it may hear. Each of those counts toward the
//deliveries the org gets in a rolling 24 hours, shared with its own
//subscribers: 10,000 on Developer Edition, 25,000 on Enterprise, 50,000 on
//Unlimited and Performance. A listening takes a tenth of what is left at most,
//and never more than MAX_LISTEN_EVENTS. Two hours is as long as the default
//session of an org lasts. Real-time streams count toward none of it.
export const LISTEN_MINUTES = [5, 15, 30, 60, 120];
export const DEFAULT_LISTEN_MINUTES = 30;
export const MAX_LISTEN_EVENTS = 1000;
export const LISTEN_SHARE = 0.1;

//What listening to the channel may take of the org's deliveries: { counted,
//used, max, remaining, percent, maxEvents }. A real-time stream is not
//counted and has no cap but its time.
export async function listenBudget(session, channel){
    if(!channel || channel.kind === REAL_TIME_CHANNEL){
        return { counted: false, maxEvents: null };
    }

    const limits = await getLimits(session, MONITOR_API_VERSION);
    const deliveries = limits.DailyDeliveredPlatformEvents;

    if(!deliveries || !deliveries.Max){
        return { counted: true, maxEvents: MAX_LISTEN_EVENTS };
    }

    const used = deliveries.Max - deliveries.Remaining;
    return {
        counted: true,
        used,
        max: deliveries.Max,
        remaining: deliveries.Remaining,
        percent: Math.round(used / deliveries.Max * 100),
        maxEvents: Math.min(MAX_LISTEN_EVENTS, Math.floor(deliveries.Remaining * LISTEN_SHARE))
    };
}

export const liveEvents = {
    key: 'liveEvents',
    section: 'realTime',
    view: LIVE,
    listen: {
        minutes: LISTEN_MINUTES,
        defaultMinutes: DEFAULT_LISTEN_MINUTES,
        maxEvents: MAX_LISTEN_EVENTS,
        alertPercent: LIMIT_ALERT_PERCENT,
        budget: listenBudget
    },
    title: 'Live events',
    description: 'Listen to a platform event, a change event or a real-time event stream of the org as it happens, each event with its payload. A real-time stream speaks once its streaming is on in the Event Manager.',
    emptyMessage: 'The org has no channel to listen to.',
    columns: [],
    groupings: [],
    async load(session){
        const described = await describeGlobal(session, MONITOR_API_VERSION);
        const items = channelsOf(described.sobjects);

        return { items, total: items.length };
    },
    summarize({ items }){
        const count = kind => items.filter(item => item.kind === kind).length;
        return {
            value: items.length,
            caption: 'channels: ' + plural(count(PLATFORM_EVENT_CHANNEL), 'platform event') + ', ' +
                plural(count(CHANGE_EVENT_CHANNEL), 'change event') + ', ' +
                plural(count(REAL_TIME_CHANNEL), 'real-time stream'),
            severity: INFO
        };
    }
};

//── Event log files: what the org has ──────────────────────────────────────
//Every file of the last days, of every type and interval, to download.
export const logFiles = {
    key: 'logFiles',
    section: 'logFiles',
    title: 'Log files to download',
    description: 'Every event log file the org has for the last ' + RECENT_DAYS + ' days, of every event type, daily and hourly, each to download as its CSV. Every org gets Login, Logout, API Total Usage and a few more free, kept for a day; the Event Monitoring add-on brings the rest, kept longer.',
    emptyMessage: 'The org has no event log file for the last ' + RECENT_DAYS + ' days.',
    requires: 'Event log files are read with the View Event Log Files permission.',
    columns: [
        { key: 'when', label: 'Of', kind: 'date' },
        { key: 'eventType', label: 'Event type' },
        { key: 'interval', label: 'Interval' },
        { key: 'size', label: 'KB', kind: 'number' }
    ],
    groupings: [
        byDay('when'),
        byField('eventType', 'By event type', 'eventType'),
        byField('size', 'KB by event type', 'eventType', item => item.size),
        byField('interval', 'By interval', 'interval')
    ],
    actions: [
        {
            key: 'download',
            label: 'Download',
            busyLabel: 'Downloading',
            run: (session, item) => downloadEventLogFile(session, item.file, MONITOR_API_VERSION)
        }
    ],
    async load(session){
        const files = await getEventLogFiles(session, { days: RECENT_DAYS, apiVersion: MONITOR_API_VERSION });
        const items = files.map(file => ({
            id: file.Id,
            when: file.LogDate,
            eventType: file.EventType,
            interval: file.Interval,
            size: Math.ceil((file.LogFileLength || 0) / 1024),
            file
        }));

        return { items, total: items.length };
    },
    summarize({ items }){
        const types = new Set(items.map(item => item.eventType)).size;
        return {
            value: types,
            caption: (types === 1 ? 'event type, ' : 'event types, ') + plural(items.length, 'file') + ' in the last ' + RECENT_DAYS + ' days',
            severity: INFO
        };
    }
};

//── Event log files: the events of one type ────────────────────────────────
//A monitor that reads the daily files of one event type of the last days,
//as many as fit MAX_LOG_FILES and MAX_LOG_BYTES, and turns their rows into
//its items with toItems(rows, session). Its summarize sees the items; the
//caption tells when the org had no file of the type, or files too big.
function eventLogMonitor(definition){
    const { eventType, toItems, summarize } = definition;

    return {
        ...definition,
        async load(session){
            const loaded = await readEventLogRows(session, {
                eventType,
                days: RECENT_DAYS,
                interval: DAILY,
                maxFiles: MAX_LOG_FILES,
                maxBytes: MAX_LOG_BYTES,
                apiVersion: MONITOR_API_VERSION
            });
            const items = await toItems(loaded.rows, session);

            return { items, total: loaded.rows.length, files: loaded.files.length, read: loaded.read.length };
        },
        summarize(loaded){
            if(!loaded.files){
                return { value: 0, caption: 'no ' + eventType + ' log file in the last ' + RECENT_DAYS + ' days', severity: INFO };
            }

            const summary = summarize(loaded);
            const unread = loaded.files - loaded.read;

            return unread ?
                { ...summary, caption: summary.caption + ', ' + plural(unread, 'log file') + ' too big to read here' } :
                summary;
        }
    };
}

//'1' and 'true' both read true in the files.
export function isTrue(value){
    return /^(1|true)$/i.test(String(value || '').trim());
}

//The frame an exception was raised in out of its stack trace, the first line
//without its line number: 'Class.Billing.run' out of
//'Class.Billing.run: line 12, column 1'.
export function originOf(stackTrace){
    const [first] = String(stackTrace || '').split(/\r?\n|\\n/);
    return first.replace(/:\s*line \d+.*$/, '').trim() || 'Unknown';
}

const callsOf = item => item.calls;

export const apiUsage = eventLogMonitor({
    key: 'apiUsage',
    section: 'logFiles',
    eventType: 'ApiTotalUsage',
    title: 'API calls by client',
    description: 'The calls to the REST, SOAP, Bulk and Connect APIs of the last ' + RECENT_DAYS + ' days, out of the API Total Usage event log files every org gets: who made them, through which client, on which object, how many counted against the API limit and how many failed.',
    emptyMessage: 'No API call in the API Total Usage log files of the last ' + RECENT_DAYS + ' days.',
    requires: 'Event log files are read with the View Event Log Files permission.',
    columns: [
        { key: 'day', label: 'Day', kind: 'day' },
        { key: 'user', label: 'User' },
        { key: 'client', label: 'Client' },
        { key: 'api', label: 'API' },
        { key: 'object', label: 'Object' },
        { key: 'calls', label: 'Calls', kind: 'number' },
        { key: 'counted', label: 'Counted', kind: 'number' },
        { key: 'failed', label: 'Failed', kind: 'number' }
    ],
    groupings: [
        { key: 'day', label: 'By day', kind: DAY, by: item => item.day, format: formatDay, sort: 'key', sum: callsOf },
        byField('client', 'By client', 'client', callsOf),
        byField('user', 'By user', 'user', callsOf),
        byField('api', 'By API', 'api', callsOf),
        byField('object', 'By object', 'object', callsOf)
    ],
    //A row per call, added up per day, user, client, API and object.
    async toItems(rows, session){
        const names = await getRecordNames(session, 'User', rows.map(row => row.USER_ID), API);
        const byKey = new Map();

        rows.forEach(row => {
            const day = dayOf(row.TIMESTAMP_DERIVED) || String(row.logDate || '').slice(0, 10);
            const user = nameOf(names, row.USER_ID);
            const client = row.CLIENT_NAME || row.CONNECTED_APP_ID || 'No client name';
            const api = row.API_FAMILY || 'Unknown';
            const object = row.ENTITY_NAME || '';
            const key = [day, user, client, api, object].join('|');
            const item = byKey.get(key) || { id: key, day, user, client, api, object, calls: 0, counted: 0, failed: 0 };

            item.calls++;
            item.counted += isTrue(row.COUNTS_AGAINST_API_LIMIT) ? 1 : 0;
            item.failed += Number(row.STATUS_CODE) >= 400 ? 1 : 0;
            byKey.set(key, item);
        });

        return [...byKey.values()].sort((a, b) => b.calls - a.calls || compareText(b.day, a.day));
    },
    summarize({ items }){
        const calls = items.reduce((total, item) => total + item.calls, 0);
        const [top] = groupItems(items, { by: item => item.client, sum: callsOf });
        return {
            value: calls,
            caption: 'in the last ' + RECENT_DAYS + ' days' + (top ? ', the most through ' + top.label : ''),
            severity: INFO
        };
    }
});

export const apexExceptions = eventLogMonitor({
    key: 'apexExceptions',
    section: 'logFiles',
    eventType: 'ApexUnexpectedException',
    title: 'Unhandled Apex exceptions',
    description: 'Every Apex exception no code caught in the last ' + RECENT_DAYS + ' days, whoever ran into it, out of the Apex Unexpected Exception event log files: unlike a debug log, it needs no trace flag. The event type comes with the Event Monitoring add-on.',
    emptyMessage: 'No Apex exception went uncaught in the log files of the last ' + RECENT_DAYS + ' days.',
    requires: 'Event log files are read with the View Event Log Files permission.',
    columns: [
        { key: 'when', label: 'When', kind: 'date' },
        { key: 'user', label: 'User' },
        { key: 'exception', label: 'Exception' },
        { key: 'message', label: 'Message' },
        { key: 'origin', label: 'Where' },
        { key: 'category', label: 'Category' }
    ],
    groupings: [
        byDay('when'),
        byField('exception', 'By exception', 'exception'),
        byField('origin', 'By origin', 'origin'),
        byField('user', 'By user', 'user'),
        byField('category', 'By category', 'category')
    ],
    async toItems(rows, session){
        const names = await getRecordNames(session, 'User', rows.map(row => row.USER_ID), API);

        return rows
            .map((row, index) => ({
                id: (row.REQUEST_ID || 'row') + '|' + index,
                when: row.TIMESTAMP_DERIVED,
                user: nameOf(names, row.USER_ID),
                exception: row.EXCEPTION_TYPE || 'Unknown',
                message: row.EXCEPTION_MESSAGE || '',
                origin: originOf(row.STACK_TRACE),
                category: row.EXCEPTION_CATEGORY || ''
            }))
            .sort((a, b) => compareText(b.when || '', a.when || ''));
    },
    summarize({ items }){
        return {
            value: items.length,
            caption: 'uncaught in the last ' + RECENT_DAYS + ' days',
            severity: severityOf(items.length)
        };
    }
});

//A synchronous request running over this long counts toward the limit of
//concurrent long running Apex requests.
export const LONG_APEX_MS = 5000;

export const slowApex = eventLogMonitor({
    key: 'slowApex',
    section: 'logFiles',
    eventType: 'ApexExecution',
    title: 'Long running Apex',
    description: 'The Apex executions of the last ' + RECENT_DAYS + ' days that ran over ' + LONG_APEX_MS / 1000 + ' s, the kind that fills the limit of concurrent long running requests, out of every execution of the Apex Execution event log files. The event type comes with the Event Monitoring add-on.',
    emptyMessage: 'No Apex execution of the last ' + RECENT_DAYS + ' days ran over ' + LONG_APEX_MS / 1000 + ' s.',
    requires: 'Event log files are read with the View Event Log Files permission.',
    columns: [
        { key: 'when', label: 'When', kind: 'date' },
        { key: 'entryPoint', label: 'Entry point' },
        { key: 'seconds', label: 'Seconds', kind: 'number' },
        { key: 'cpu', label: 'CPU ms', kind: 'number' },
        { key: 'soql', label: 'SOQL', kind: 'number' },
        { key: 'callouts', label: 'Callout ms', kind: 'number' }
    ],
    groupings: [
        byDay('when'),
        byField('entryPoint', 'By entry point', 'entryPoint'),
        byField('time', 'Seconds by entry point', 'entryPoint', item => item.seconds)
    ],
    toItems(rows){
        return rows
            .filter(row => Number(row.EXEC_TIME) > LONG_APEX_MS)
            .map((row, index) => ({
                id: (row.REQUEST_ID || 'row') + '|' + index,
                when: row.TIMESTAMP_DERIVED,
                entryPoint: row.ENTRY_POINT || 'Unknown',
                seconds: round1(Number(row.EXEC_TIME) / 1000),
                cpu: Number(row.CPU_TIME) || 0,
                soql: Number(row.NUMBER_SOQL_QUERIES) || 0,
                callouts: Number(row.CALLOUT_TIME) || 0
            }))
            .sort((a, b) => b.seconds - a.seconds);
    },
    summarize({ items, total }){
        return {
            value: items.length,
            caption: of(total, 'execution') + ' ran over ' + LONG_APEX_MS / 1000 + ' s',
            severity: severityOf(items.length)
        };
    }
});

export const reportExports = eventLogMonitor({
    key: 'reportExports',
    section: 'logFiles',
    eventType: 'ReportExport',
    title: 'Reports exported',
    description: 'The reports exported out of the org in the last ' + RECENT_DAYS + ' days, who exported them, from which IP and with what, out of the Report Export event log files. The event type comes with the Event Monitoring add-on.',
    emptyMessage: 'No report was exported in the last ' + RECENT_DAYS + ' days.',
    requires: 'Event log files are read with the View Event Log Files permission.',
    columns: [
        { key: 'when', label: 'When', kind: 'date' },
        { key: 'user', label: 'User' },
        { key: 'report', label: 'Report' },
        { key: 'client', label: 'Client' },
        { key: 'sourceIp', label: 'IP' }
    ],
    groupings: [
        byDay('when'),
        byField('user', 'By user', 'user'),
        byField('report', 'By report', 'report')
    ],
    async toItems(rows, session){
        const [users, reports] = await Promise.all([
            getRecordNames(session, 'User', rows.map(row => row.USER_ID), API),
            getRecordNames(session, 'Report', rows.map(row => row.REPORT_ID), API)
        ]);

        return rows
            .map((row, index) => ({
                id: (row.REQUEST_ID || 'row') + '|' + index,
                when: row.TIMESTAMP_DERIVED,
                user: nameOf(users, row.USER_ID),
                report: nameOf(reports, row.REPORT_ID),
                client: row.CLIENT_INFO || '',
                sourceIp: row.CLIENT_IP || ''
            }))
            .sort((a, b) => compareText(b.when || '', a.when || ''));
    },
    summarize({ items }){
        const users = new Set(items.map(item => item.user)).size;
        return {
            value: items.length,
            caption: 'in the last ' + RECENT_DAYS + ' days' + (users ? ', by ' + plural(users, 'user') : ''),
            severity: INFO
        };
    }
});

//── Lightning pages: how long they take ────────────────────────────────────
//The Lightning usage metrics, a row per page, user and day, added up per page
//over the last days: how often each page was viewed, by how many users, and
//its effective page time, from the click to the page drawn, on average.
export const FAST_PAGE_SECONDS = 3;
export const SLOW_PAGE_SECONDS = 5;
const PAGE_SOQL = 'SELECT PageName, SUM(TotalCount) views, SUM(SumEPT) eptSum, SUM(RecordCountEPT) eptCount, COUNT_DISTINCT(UserId) users ' +
    'FROM LightningUsageByPageMetrics WHERE MetricsDate = LAST_N_DAYS:' + LIGHTNING_DAYS + ' GROUP BY PageName ORDER BY SUM(TotalCount) DESC LIMIT ' + MAX_ROWS;

export function speedOf(seconds){
    if(seconds === null || seconds === undefined){
        return 'No timing';
    }
    if(seconds < FAST_PAGE_SECONDS){
        return 'Under ' + FAST_PAGE_SECONDS + ' s';
    }
    return seconds < SLOW_PAGE_SECONDS ? FAST_PAGE_SECONDS + ' to ' + SLOW_PAGE_SECONDS + ' s' : 'Over ' + SLOW_PAGE_SECONDS + ' s';
}

export const slowPages = {
    key: 'slowPages',
    section: 'lightning',
    title: 'Slow Lightning pages',
    description: 'The Lightning pages whose effective page time, from the click to the page drawn, averaged over ' + SLOW_PAGE_SECONDS + ' s in the last ' + LIGHTNING_DAYS + ' days, out of every page viewed, with how often and by how many users, as the Lightning Usage app reads it.',
    emptyMessage: 'No Lightning page was viewed in the last ' + LIGHTNING_DAYS + ' days.',
    requires: 'This org does not open its Lightning usage metrics to the API, or the user may not read them: they need Lightning Experience and the View Setup and Configuration permission.',
    columns: [
        { key: 'page', label: 'Page' },
        { key: 'seconds', label: 'Seconds', kind: 'number' },
        { key: 'views', label: 'Views', kind: 'number' },
        { key: 'users', label: 'Users', kind: 'number' }
    ],
    groupings: [
        { key: 'seconds', label: 'Seconds by page', by: item => item.page, sum: item => item.seconds || 0, rest: 'drop' },
        byField('views', 'Views by page', 'page', item => item.views),
        byField('speed', 'By speed', 'speed')
    ],
    async load(session){
        const pages = await queryAll(session, PAGE_SOQL, API);
        const items = pages
            .map(page => {
                const seconds = page.eptCount ? round1(page.eptSum / page.eptCount / 1000) : null;
                return {
                    id: page.PageName || 'Unknown',
                    page: page.PageName || 'Unknown',
                    views: page.views || 0,
                    users: page.users || 0,
                    seconds,
                    speed: speedOf(seconds),
                    isStuck: seconds !== null && seconds >= SLOW_PAGE_SECONDS
                };
            })
            .sort((a, b) => (b.seconds || 0) - (a.seconds || 0) || b.views - a.views);

        return { items, total: items.length };
    },
    summarize({ items }){
        const slow = items.filter(item => item.isStuck).length;
        const [slowest] = items;
        return {
            value: slow,
            caption: of(items.length, 'page') + ' viewed in the last ' + LIGHTNING_DAYS + ' days' +
                (slowest && slowest.seconds ? ', the slowest at ' + slowest.seconds + ' s' : ''),
            severity: severityOf(slow)
        };
    }
};

export const MONITORS = [
    orgLimits,
    failedLogins, setupChanges, threatDetection, securityPolicies,
    realTimeEvents, liveEvents,
    failedLogs, failedJobs, scheduledJobs,
    logFiles, apiUsage, apexExceptions, slowApex, reportExports,
    eventSubscribers, platformEvents, eventUsage,
    flowInterviews, flows,
    slowPages
];

//The sections with their monitors, in the order of SECTIONS, the empty ones
//left out.
export function getSections(monitors = MONITORS){
    return SECTIONS
        .map(section => ({ ...section, monitors: monitors.filter(monitor => monitor.section === section.key) }))
        .filter(section => section.monitors.length);
}

export function getMonitor(key){
    return MONITORS.find(monitor => monitor.key === key);
}
