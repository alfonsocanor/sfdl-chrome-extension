import {
    MONITORS,
    SECTIONS,
    getMonitor,
    getSections,
    failedLogs,
    failedJobs,
    scheduledJobs,
    eventSubscribers,
    platformEvents,
    eventUsage,
    flowInterviews,
    flows,
    orgLimits,
    failedLogins,
    setupChanges,
    threatDetection,
    securityPolicies,
    logFiles,
    apiUsage,
    apexExceptions,
    slowApex,
    reportExports,
    slowPages,
    realTimeEvents,
    liveEvents,
    channelsOf,
    realTimeEventLabel,
    listenBudget,
    LISTEN_MINUTES,
    DEFAULT_LISTEN_MINUTES,
    MAX_LISTEN_EVENTS,
    isUnavailableError,
    plural,
    originOf,
    isTrue,
    speedOf,
    MAX_LOG_FILES,
    MAX_LOG_BYTES,
    limitLabel,
    isPlatformEvent,
    groupItems,
    fillDays,
    summarizeMonitor,
    errorKindOf,
    dayOf,
    formatDay,
    formatDateTime,
    MAX_BARS,
    MONITOR_API_VERSION,
    ALERT,
    CLEAR,
    INFO
} from 'sfdl/monitors';
import { queryAll, queryCount, getLimits, describeGlobal, getRecordNames, updateRecord } from 'sfdl/salesforceConnection';
import { readEventLogRows, getEventLogFiles, downloadEventLogFile } from 'sfdl/eventLogFiles';
import { readMetadata, updateMetadata } from 'sfdl/metadataApi';

jest.mock('sfdl/salesforceConnection', () =>
    Object.assign({}, jest.requireActual('sfdl/salesforceConnection'), {
        queryAll: jest.fn(),
        queryCount: jest.fn(),
        getLimits: jest.fn(),
        describeGlobal: jest.fn(),
        getRecordNames: jest.fn(),
        updateRecord: jest.fn()
    })
);
jest.mock('sfdl/metadataApi', () =>
    Object.assign({}, jest.requireActual('sfdl/metadataApi'), {
        readMetadata: jest.fn(),
        updateMetadata: jest.fn()
    })
);
jest.mock('sfdl/eventLogFiles', () =>
    Object.assign({}, jest.requireActual('sfdl/eventLogFiles'), {
        readEventLogRows: jest.fn(),
        getEventLogFiles: jest.fn(),
        downloadEventLogFile: jest.fn()
    })
);

const ACME = {
    instanceUrl: 'https://acme.my.salesforce.com',
    authToken: 'sid-acme'
};

describe('monitors', () => {
    describe('the catalogue', () => {
        it('lists every monitor with what the tab needs of it', () => {
            expect(MONITORS.map((monitor) => monitor.key)).toEqual([
                'orgLimits',
                'failedLogins',
                'setupChanges',
                'threatDetection',
                'securityPolicies',
                'realTimeEvents',
                'liveEvents',
                'failedLogs',
                'failedJobs',
                'scheduledJobs',
                'logFiles',
                'apiUsage',
                'apexExceptions',
                'slowApex',
                'reportExports',
                'eventSubscribers',
                'platformEvents',
                'eventUsage',
                'flowInterviews',
                'flows',
                'slowPages'
            ]);
            MONITORS.forEach((monitor) => {
                expect(SECTIONS.map((section) => section.key)).toContain(monitor.section);
                expect(typeof monitor.title).toBe('string');
                expect(typeof monitor.description).toBe('string');
                expect(typeof monitor.emptyMessage).toBe('string');
                expect(typeof monitor.load).toBe('function');
                expect(typeof monitor.summarize).toBe('function');
                expect(Array.isArray(monitor.columns)).toBe(true);
                expect(Array.isArray(monitor.groupings)).toBe(true);
                expect(new Set(monitor.groupings.map((grouping) => grouping.key)).size).toBe(monitor.groupings.length);
                (monitor.actions || []).forEach((action) => expect(typeof action.run).toBe('function'));
            });
            expect(new Set(MONITORS.map((monitor) => monitor.key)).size).toBe(MONITORS.length);
            expect(getMonitor('failedJobs')).toBe(failedJobs);
            expect(getMonitor('nothing')).toBeUndefined();
        });

        it('hands the sections with their monitors, the limits first as meters, the empty ones left out', () => {
            const sections = getSections();

            expect(sections.map((section) => section.key)).toEqual(['limits', 'security', 'realTime', 'apex', 'logFiles', 'events', 'flows', 'lightning']);
            expect(sections[0].presentation).toBe('meters');
            expect(sections[0].monitors).toEqual([orgLimits]);
            expect(sections[5].monitors.map((monitor) => monitor.key)).toEqual([
                'eventSubscribers',
                'platformEvents',
                'eventUsage'
            ]);
            expect(getSections([flows]).map((section) => section.key)).toEqual(['flows']);
        });
    });

    describe('helpers', () => {
        it('reads the kind of an error out of its message', () => {
            expect(
                errorKindOf('System.NullPointerException: Attempt to de-reference')
            ).toBe('System.NullPointerException');
            expect(errorKindOf('Internal Salesforce Error')).toBe(
                'Internal Salesforce Error'
            );
            expect(errorKindOf('')).toBe('Unknown');
        });

        it('formats days and dates the way the log names do', () => {
            const date = new Date(2026, 9, 7, 9, 5);
            expect(dayOf(date.toISOString())).toBe('2026-10-07');
            expect(formatDay('2026-10-07')).toBe('07/10');
            expect(formatDay('')).toBe('No date');
            expect(formatDateTime(date.toISOString())).toBe('07/10 09:05');
            expect(formatDateTime(undefined)).toBe('');
        });

        it('groups the items biggest first with the share of the biggest', () => {
            const items = [
                { user: 'Ann' },
                { user: 'Bob' },
                { user: 'Ann' },
                { user: 'Ann' },
                { user: '' }
            ];

            const groups = groupItems(items, { key: 'user', by: (item) => item.user });

            expect(groups).toEqual([
                { key: 'Ann', label: 'Ann', count: 3, percent: 100 },
                { key: 'Bob', label: 'Bob', count: 1, percent: 33 },
                { key: 'Unknown', label: 'Unknown', count: 1, percent: 33 }
            ]);
        });

        it('sorts a grouping by key when it asks and formats its labels', () => {
            const items = [{ day: '2026-10-09' }, { day: '2026-10-07' }, { day: '2026-10-09' }];

            const groups = groupItems(items, {
                key: 'day',
                by: (item) => item.day,
                format: formatDay,
                sort: 'key'
            });

            expect(groups.map((group) => group.label)).toEqual(['07/10', '09/10']);
            expect(groups.map((group) => group.count)).toEqual([1, 2]);
        });

        it('folds the smallest groups past the bars it draws into Other', () => {
            const items = Array.from({ length: 14 }, (unused, index) => ({
                name: 'Class' + String(index).padStart(2, '0')
            }));
            items.push({ name: 'Class00' });

            const groups = groupItems(items, { key: 'name', by: (item) => item.name });

            expect(groups.length).toBe(MAX_BARS);
            expect(groups[0]).toEqual({ key: 'Class00', label: 'Class00', count: 2, percent: 40 });
            expect(groups[MAX_BARS - 1]).toEqual({
                key: 'other',
                label: 'Other (5)',
                count: 5,
                percent: 100
            });
        });

        it('spreads the groups of a day over the run of days up to today, the empty ones at 0', () => {
            const today = dayOf(new Date().toISOString());
            const twoDaysAgo = dayOf(new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString());

            const days = fillDays([
                { key: twoDaysAgo, label: formatDay(twoDaysAgo), count: 3 },
                { key: 'Unknown', label: 'Unknown', count: 9 }
            ]);

            expect(days.length).toBe(3);
            expect(days[0]).toEqual({ key: twoDaysAgo, label: formatDay(twoDaysAgo), count: 3, percent: 100 });
            expect(days[1].count).toBe(0);
            expect(days[1].percent).toBe(0);
            expect(days[2].key).toBe(today);
            expect(fillDays([])).toEqual([]);
        });

        it('keeps only the latest days past the columns it draws, and never folds a day into Other', () => {
            const items = Array.from({ length: 70 }, (unused, index) => ({
                when: new Date(Date.now() - index * 24 * 60 * 60 * 1000).toISOString()
            }));
            const grouping = { key: 'day', kind: 'day', by: (item) => dayOf(item.when), format: formatDay, sort: 'key' };

            const groups = groupItems(items, grouping);
            expect(groups.length).toBe(70);
            expect(groups.some((group) => group.key === 'other')).toBe(false);

            const days = fillDays(groups);
            expect(days.length).toBe(60);
            expect(days[59].key).toBe(dayOf(new Date().toISOString()));
        });

        it('sums what a grouping asks to sum instead of counting', () => {
            const items = [
                { day: '2026-10-07', value: 10 },
                { day: '2026-10-09', value: 5 },
                { day: '2026-10-07', value: 30 }
            ];

            const groups = groupItems(items, {
                key: 'day',
                by: (item) => item.day,
                sort: 'key',
                sum: (item) => item.value
            });

            expect(groups.map((group) => group.count)).toEqual([40, 5]);
            expect(groups.map((group) => group.percent)).toEqual([100, 13]);
        });

        it('summarizeMonitor adds the words of the severity', () => {
            expect(
                summarizeMonitor(failedLogs, { items: [{}], total: 3 })
            ).toEqual({
                value: 1,
                caption: 'of 3 debug logs in the org',
                severity: ALERT,
                severityLabel: 'Needs a look'
            });
            expect(
                summarizeMonitor(failedLogs, { items: [], total: 1 }).severityLabel
            ).toBe('All clear');
            expect(
                summarizeMonitor(flows, { items: [], total: 0 }).severityLabel
            ).toBe('Overview');
        });
    });

    describe('failed debug logs', () => {
        it('keeps the logs that did not end in Success out of every log of the org', async () => {
            queryAll.mockResolvedValue([
                {
                    Id: '07L1',
                    LastModifiedDate: '2026-10-12T10:00:00.000Z',
                    LogLength: 10,
                    LogUser: { Name: 'Ann' },
                    Operation: 'Api',
                    Status: 'Success'
                },
                {
                    Id: '07L2',
                    LastModifiedDate: '2026-10-12T11:00:00.000Z',
                    LogLength: 20,
                    LogUser: { Name: 'Bob' },
                    Operation: '/apex/MyPage',
                    Status: 'System.LimitException: Too many SOQL queries: 101'
                }
            ]);

            const loaded = await failedLogs.load(ACME);

            expect(queryAll).toHaveBeenCalledWith(ACME, expect.stringContaining('FROM ApexLog'), { tooling: true, apiVersion: MONITOR_API_VERSION });
            expect(loaded).toEqual({
                items: [
                    {
                        id: '07L2',
                        when: '2026-10-12T11:00:00.000Z',
                        user: 'Bob',
                        operation: '/apex/MyPage',
                        status: 'System.LimitException: Too many SOQL queries: 101',
                        length: 20
                    }
                ],
                total: 2
            });
            expect(failedLogs.summarize(loaded)).toEqual({
                value: 1,
                caption: 'of 2 debug logs in the org',
                severity: ALERT
            });
        });
    });

    describe('failed async jobs', () => {
        it('reads the failed jobs of the last days and how many jobs ran', async () => {
            queryAll.mockResolvedValue([
                {
                    Id: '707A',
                    ApexClass: { Name: 'NightlyBatch' },
                    MethodName: null,
                    JobType: 'BatchApex',
                    Status: 'Completed',
                    ExtendedStatus: 'First error: Too many DML rows',
                    NumberOfErrors: 2,
                    JobItemsProcessed: 10,
                    TotalJobItems: 10,
                    CreatedDate: '2026-10-12T01:00:00.000Z',
                    CreatedBy: { Name: 'Automated Process' }
                },
                {
                    Id: '707B',
                    ApexClass: { Name: 'Sync' },
                    MethodName: 'pushAsync',
                    JobType: 'Future',
                    Status: 'Failed',
                    ExtendedStatus: null,
                    NumberOfErrors: 0,
                    JobItemsProcessed: 0,
                    TotalJobItems: 0,
                    CreatedDate: '2026-10-11T01:00:00.000Z',
                    CreatedBy: { Name: 'Ann' }
                }
            ]);
            queryCount.mockResolvedValue(57);

            const loaded = await failedJobs.load(ACME);

            expect(queryAll.mock.calls[0][1]).toContain("(Status = 'Failed' OR NumberOfErrors > 0)");
            expect(queryAll.mock.calls[0][1]).toContain("JobType != 'BatchApexWorker'");
            expect(queryCount.mock.calls[0][1]).toContain('SELECT COUNT() FROM AsyncApexJob');
            expect(loaded.total).toBe(57);
            expect(loaded.items).toEqual([
                {
                    id: '707A',
                    when: '2026-10-12T01:00:00.000Z',
                    apexClass: 'NightlyBatch',
                    jobType: 'BatchApex',
                    user: 'Automated Process',
                    status: 'Completed',
                    progress: '10 of 10, 2 failed',
                    error: 'First error: Too many DML rows'
                },
                {
                    id: '707B',
                    when: '2026-10-11T01:00:00.000Z',
                    apexClass: 'Sync.pushAsync',
                    jobType: 'Future',
                    user: 'Ann',
                    status: 'Failed',
                    progress: '',
                    error: ''
                }
            ]);
            expect(failedJobs.summarize(loaded)).toEqual({
                value: 2,
                caption: 'of 57 async jobs in the last 7 days',
                severity: ALERT
            });
        });
    });

    describe('scheduled jobs', () => {
        it('lists every trigger, the stuck ones first, and counts them', async () => {
            queryAll.mockResolvedValue([
                {
                    Id: '08e1',
                    CronJobDetail: { Name: 'Nightly', JobType: '7' },
                    State: 'WAITING',
                    PreviousFireTime: '2026-10-12T01:00:00.000Z',
                    NextFireTime: '2026-10-13T01:00:00.000Z',
                    TimesTriggered: 40,
                    CreatedBy: { Name: 'Ann' }
                },
                {
                    Id: '08e2',
                    CronJobDetail: { Name: 'Weekly report', JobType: '8' },
                    State: 'ERROR',
                    PreviousFireTime: null,
                    NextFireTime: null,
                    TimesTriggered: 0,
                    CreatedBy: { Name: 'Bob' }
                }
            ]);

            const loaded = await scheduledJobs.load(ACME);

            expect(loaded.items.map((item) => item.name)).toEqual(['Weekly report', 'Nightly']);
            expect(loaded.items[0]).toEqual({
                id: '08e2',
                name: 'Weekly report',
                jobType: 'Report run',
                state: 'ERROR',
                previousFire: null,
                nextFire: null,
                timesTriggered: 0,
                user: 'Bob',
                isStuck: true
            });
            expect(loaded.items[1].jobType).toBe('Scheduled Apex');
            expect(scheduledJobs.summarize(loaded)).toEqual({
                value: 1,
                caption: 'of 2 scheduled jobs',
                severity: ALERT
            });
        });
    });

    describe('limits of the org', () => {
        it('reads every limit the org has, the most used first, and carries that one', async () => {
            getLimits.mockResolvedValue({
                DailyApiRequests: { Max: 15000, Remaining: 1500, MyApp: { Max: 0, Remaining: 0 } },
                DailyAsyncApexExecutions: { Max: 250000, Remaining: 250000 },
                DataStorageMB: { Max: 0, Remaining: 0 },
                PermissionSets: { Max: 1500, Remaining: 1200 }
            });

            const loaded = await orgLimits.load(ACME);

            expect(loaded.items).toEqual([
                { id: 'DailyApiRequests', name: 'DailyApiRequests', label: 'API requests today', aliases: ['rest', 'soap', 'calls', 'api calls'], used: 13500, max: 15000, percent: 90, isUnused: false },
                { id: 'PermissionSets', name: 'PermissionSets', label: 'Permission sets', aliases: ['perms', 'permset', 'permissions'], used: 300, max: 1500, percent: 20, isUnused: false },
                { id: 'DailyAsyncApexExecutions', name: 'DailyAsyncApexExecutions', label: 'Async Apex executions today', aliases: ['batch', 'queueable', 'future', 'jobs'], used: 0, max: 250000, percent: 0, isUnused: true }
            ]);
            expect(getLimits).toHaveBeenCalledWith(ACME, MONITOR_API_VERSION);
            expect(orgLimits.summarize(loaded)).toEqual({
                value: '90%',
                caption: 'API requests today, 13500 of 15000',
                severity: ALERT
            });
        });

        it('orders the limits by the exact share used, the barely touched before the untouched', async () => {
            getLimits.mockResolvedValue({
                SingleEmail: { Max: 15, Remaining: 15 },
                DailyAsyncApexExecutions: { Max: 250000, Remaining: 249900 },
                HourlyODataCallout: { Max: 20000, Remaining: 20000 },
                DailyApiRequests: { Max: 15000, Remaining: 14999 }
            });

            const loaded = await orgLimits.load(ACME);

            expect(loaded.items.map((item) => item.name)).toEqual([
                'DailyAsyncApexExecutions',
                'DailyApiRequests',
                'HourlyODataCallout',
                'SingleEmail'
            ]);
            expect(loaded.items.map((item) => item.percent)).toEqual([0, 0, 0, 0]);
        });

        it('counts the limits past the alert line in the caption', () => {
            const limit = (label, percent) => ({ label, used: percent, max: 100, percent });

            expect(
                orgLimits.summarize({ items: [limit('A', 95), limit('B', 85), limit('C', 10)] }).caption
            ).toBe('A, 95 of 100, 2 limits past 80%');
        });

        it('gives a limit its name in words, split when it has none', () => {
            expect(limitLabel('DailyDeliveredPlatformEvents')).toBe('Platform events delivered today');
            expect(limitLabel('SomeNewLimitMB')).toBe('Some New Limit MB');
        });

        it('is clear under the alert line and with nothing reported', () => {
            expect(
                orgLimits.summarize({ items: [{ label: 'A', used: 1, max: 10, percent: 10 }] })
            ).toEqual({ value: '10%', caption: 'A, 1 of 10', severity: CLEAR });
            expect(orgLimits.summarize({ items: [] })).toEqual({
                value: '0%',
                caption: 'No limit reported',
                severity: CLEAR
            });
        });
    });

    describe('event subscribers', () => {
        it('lists every subscriber with its lag, the ones in trouble first', async () => {
            queryAll.mockResolvedValue([
                { ExternalId: 'x1', Name: 'OrderTrigger', Topic: 'Order_Event__e', Type: 'ApexTrigger', Status: 'Running', Position: 95, Tip: 100, Retries: 0, LastError: null },
                { ExternalId: 'x2', Name: 'ShipTrigger', Topic: 'Ship_Event__e', Type: 'ApexTrigger', Status: 'Suspended', Position: 10, Tip: 100, Retries: 9, LastError: 'System.NullPointerException: boom' },
                { ExternalId: 'x3', Name: 'client', Topic: 'Order_Event__e', Type: 'CometD', Status: 'Idle', Position: 100, Tip: 100, Retries: 0, LastError: null }
            ]);

            const loaded = await eventSubscribers.load(ACME);

            expect(queryAll.mock.calls[0][1]).toContain('FROM EventBusSubscriber');
            expect(loaded.items.map((item) => item.name)).toEqual(['ShipTrigger', 'OrderTrigger', 'client']);
            expect(loaded.items[0]).toEqual({
                id: 'x2', name: 'ShipTrigger', topic: 'Ship_Event__e', type: 'ApexTrigger', status: 'Suspended',
                lag: 90, retries: 9, error: 'System.NullPointerException: boom', isStuck: true
            });
            expect(loaded.items[1].lag).toBe(5);
            expect(eventSubscribers.summarize(loaded)).toEqual({ value: 1, caption: 'of 3 subscribers', severity: ALERT });
        });
    });

    describe('platform events defined', () => {
        it('tells a platform event from the other objects', () => {
            expect(isPlatformEvent({ name: 'Order_Event__e', queryable: false })).toBe(true);
            expect(isPlatformEvent({ name: 'BatchApexErrorEvent', queryable: false })).toBe(true);
            expect(isPlatformEvent({ name: 'AccountChangeEvent', queryable: false })).toBe(false);
            expect(isPlatformEvent({ name: 'Event', queryable: true })).toBe(false);
            expect(isPlatformEvent({ name: 'ApiEvent', queryable: true })).toBe(false);
        });

        it('lists the events, custom first, with how many subscribe to each', async () => {
            describeGlobal.mockResolvedValue({
                sobjects: [
                    { name: 'Account', label: 'Account', custom: false, queryable: true },
                    { name: 'Order_Event__e', label: 'Order Event', custom: true, queryable: false },
                    { name: 'BatchApexErrorEvent', label: 'Batch Apex Error Event', custom: false, queryable: false },
                    { name: 'AccountChangeEvent', label: 'Account Change Event', custom: false, queryable: false }
                ]
            });
            queryAll.mockResolvedValue([{ Topic: 'Order_Event__e' }, { Topic: 'Order_Event__e' }]);

            const loaded = await platformEvents.load(ACME);

            expect(loaded.items).toEqual([
                { id: 'Order_Event__e', name: 'Order_Event__e', label: 'Order Event', kind: 'Custom', subscribers: 2 },
                { id: 'BatchApexErrorEvent', name: 'BatchApexErrorEvent', label: 'Batch Apex Error Event', kind: 'Standard', subscribers: 0 }
            ]);
            expect(platformEvents.summarize(loaded)).toEqual({
                value: 1,
                caption: 'custom, 1 of 2 events subscribed',
                severity: INFO
            });
        });
    });

    describe('events delivered', () => {
        it('reads the usage metrics of the last days and sums what was delivered and published', async () => {
            queryAll.mockResolvedValue([
                { Name: 'DELIVERED', StartDate: '2026-10-12T00:00:00.000Z', EndDate: '2026-10-13T00:00:00.000Z', Value: 300 },
                { Name: 'PUBLISHED', StartDate: '2026-10-12T00:00:00.000Z', EndDate: '2026-10-13T00:00:00.000Z', Value: 100 },
                { Name: 'DELIVERED', StartDate: '2026-10-11T00:00:00.000Z', EndDate: '2026-10-12T00:00:00.000Z', Value: 50 }
            ]);

            const loaded = await eventUsage.load(ACME);

            expect(queryAll.mock.calls[0][1]).toMatch(/FROM PlatformEventUsageMetric WHERE StartDate >= \d{4}-\d{2}-\d{2}T/);
            expect(loaded.items.map((item) => item.value)).toEqual([300, 100, 50]);
            expect(loaded.items[0].metric).toBe('DELIVERED');
            expect(eventUsage.summarize(loaded)).toEqual({
                value: 350,
                caption: 'delivered, 100 published in the last 7 days',
                severity: INFO
            });
        });
    });

    describe('flow interviews', () => {
        it('lists the paused interviews, the failed ones first, and counts them', async () => {
            queryAll.mockResolvedValue([
                { Id: '0Fo1', Name: 'Onboarding', InterviewLabel: 'Ann onboarding', CurrentElement: 'Wait_for_doc', PauseLabel: null, InterviewStatus: 'Paused', CreatedDate: '2026-10-12T01:00:00.000Z', CreatedBy: { Name: 'Ann' } },
                { Id: '0Fo2', Name: 'Renewal', InterviewLabel: null, CurrentElement: 'Update_contract', PauseLabel: 'renewal', InterviewStatus: 'Error', CreatedDate: '2026-10-11T01:00:00.000Z', CreatedBy: { Name: 'Bob' } }
            ]);

            const loaded = await flowInterviews.load(ACME);

            expect(queryAll.mock.calls[0][1]).toContain('FROM FlowInterview');
            expect(loaded.items.map((item) => item.flow)).toEqual(['Renewal', 'Onboarding']);
            expect(loaded.items[0]).toEqual({
                id: '0Fo2', when: '2026-10-11T01:00:00.000Z', flow: 'Renewal', label: 'renewal', element: 'Update_contract',
                status: 'Error', user: 'Bob', isStuck: true
            });
            expect(flowInterviews.summarize(loaded)).toEqual({ value: 1, caption: 'of 2 interviews paused or waiting', severity: ALERT });
        });
    });

    describe('flows', () => {
        it('lists every flow with its state, the ones with a newer draft first', async () => {
            queryAll.mockResolvedValue([
                { ApiName: 'Onboarding', Label: 'Onboarding', ProcessType: 'Flow', TriggerType: null, TriggerObjectOrEventLabel: null, IsActive: true, ActiveVersionId: 'v1', LatestVersionId: 'v1', LastModifiedBy: 'Ann', LastModifiedDate: '2026-10-01T00:00:00.000Z' },
                { ApiName: 'Account_after', Label: 'Account after save', ProcessType: 'AutoLaunchedFlow', TriggerType: 'RecordAfterSave', TriggerObjectOrEventLabel: 'Account', IsActive: true, ActiveVersionId: 'v2', LatestVersionId: 'v3', LastModifiedBy: 'Bob', LastModifiedDate: '2026-10-02T00:00:00.000Z' },
                { ApiName: 'Old', Label: 'Old', ProcessType: 'Flow', TriggerType: null, TriggerObjectOrEventLabel: null, IsActive: false, ActiveVersionId: null, LatestVersionId: 'v1', LastModifiedBy: 'Ann', LastModifiedDate: '2026-09-01T00:00:00.000Z' }
            ]);

            const loaded = await flows.load(ACME);

            expect(queryAll.mock.calls[0][1]).toContain('FROM FlowDefinitionView');
            expect(queryAll.mock.calls[0][2]).toEqual({ apiVersion: MONITOR_API_VERSION });
            expect(loaded.items.map((item) => item.state)).toEqual(['Active, newer draft', 'Inactive', 'Active']);
            expect(loaded.items[0]).toEqual({
                id: 'Account_after', name: 'Account_after', label: 'Account after save', processType: 'AutoLaunchedFlow',
                triggerType: 'RecordAfterSave', triggerObject: 'Account', state: 'Active, newer draft',
                modifiedBy: 'Bob', modified: '2026-10-02T00:00:00.000Z', isStuck: true
            });
            expect(loaded.items[1].triggerType).toBe('None');
            expect(flows.summarize(loaded)).toEqual({ value: 2, caption: 'of 3 flows, 1 inactive', severity: INFO });
        });
    });

    describe('the helpers of the new monitors', () => {
        it('says a count with its noun', () => {
            expect(plural(1, 'policy')).toBe('1 policy');
            expect(plural(2, 'policy')).toBe('2 policies');
            expect(plural(0, 'day')).toBe('0 days');
            expect(plural(3, 'login')).toBe('3 logins');
        });

        it('tells an org without the feature from an error', () => {
            expect(isUnavailableError({ errorCode: 'INVALID_TYPE' })).toBe(true);
            expect(isUnavailableError({ errorCode: 'INSUFFICIENT_ACCESS_OR_READONLY' })).toBe(true);
            expect(isUnavailableError({ status: 403 })).toBe(true);
            expect(isUnavailableError({ errorCode: 'INVALID_FIELD', status: 400 })).toBe(false);
            expect(isUnavailableError(undefined)).toBe(false);
        });

        it('reads where an exception was raised out of its stack trace', () => {
            expect(originOf('Class.Billing.run: line 12, column 1\nTrigger.AccountTrigger: line 3, column 1')).toBe('Class.Billing.run');
            expect(originOf('AnonymousBlock: line 1, column 1')).toBe('AnonymousBlock');
            expect(originOf('')).toBe('Unknown');
        });

        it('reads true the way the log files write it', () => {
            expect(isTrue('1')).toBe(true);
            expect(isTrue('true')).toBe(true);
            expect(isTrue('TRUE')).toBe(true);
            expect(isTrue('0')).toBe(false);
            expect(isTrue('')).toBe(false);
        });

        it('puts a page time in its band', () => {
            expect(speedOf(null)).toBe('No timing');
            expect(speedOf(1.2)).toBe('Under 3 s');
            expect(speedOf(3)).toBe('3 to 5 s');
            expect(speedOf(5)).toBe('Over 5 s');
        });

        it('drops the groups past the bars when a grouping asks, and rounds a sum to a decimal', () => {
            const items = Array.from({ length: 12 }, (unused, index) => ({ name: 'P' + String(index).padStart(2, '0'), seconds: 0.1 + index / 10 }));
            items.push({ name: 'P00', seconds: 0.2 });

            const dropped = groupItems(items, { by: (item) => item.name, sum: (item) => item.seconds, rest: 'drop' });

            expect(dropped.length).toBe(10);
            expect(dropped.some((group) => group.key === 'other')).toBe(false);
            expect(dropped[0]).toEqual({ key: 'P11', label: 'P11', count: 1.2, percent: 100 });
            expect(dropped.find((group) => group.key === 'P00').count).toBe(0.3);
        });
    });

    describe('failed logins', () => {
        const login = (id, userId, status, sourceIp) => ({
            Id: id, UserId: userId, LoginTime: '2026-10-12T10:00:00.000Z', LoginType: 'Application', Status: status,
            SourceIp: sourceIp, Application: 'Browser', Browser: 'Chrome 130', Platform: 'Mac OSX', CountryIso: 'ES'
        });

        it('keeps the logins that failed with the names of their users, out of every login of the days', async () => {
            queryAll.mockResolvedValue([
                login('0Ya0', '005000000000002AAA', 'Success', '1.1.1.1'),
                login('0Ya1', '005000000000001AAA', 'Invalid Password', '1.1.1.1')
            ]);
            queryCount.mockResolvedValue(120);
            getRecordNames.mockResolvedValue(new Map([['005000000000001', 'Ann']]));

            const loaded = await failedLogins.load(ACME);

            expect(queryAll.mock.calls[0][1]).toBe(
                'SELECT Id, UserId, LoginTime, LoginType, Status, SourceIp, Application, Browser, Platform, CountryIso FROM LoginHistory WHERE LoginTime = LAST_N_DAYS:7 ORDER BY LoginTime DESC LIMIT 10000'
            );
            expect(queryCount.mock.calls[0][1]).toBe('SELECT COUNT() FROM LoginHistory WHERE LoginTime = LAST_N_DAYS:7');
            expect(getRecordNames).toHaveBeenCalledWith(ACME, 'User', ['005000000000001AAA'], { apiVersion: MONITOR_API_VERSION });
            expect(loaded).toEqual({
                items: [{
                    id: '0Ya1', when: '2026-10-12T10:00:00.000Z', user: 'Ann', status: 'Invalid Password', loginType: 'Application',
                    application: 'Browser', sourceIp: '1.1.1.1', country: 'ES', browser: 'Chrome 130, Mac OSX', isStuck: false
                }],
                total: 120,
                read: 2
            });
            expect(failedLogins.summarize(loaded)).toEqual({ value: 1, caption: 'of 120 logins in the last 7 days, the latest 2 read', severity: INFO });
            expect(failedLogins.summarize({ ...loaded, total: 2 }).caption).toBe('of 2 logins in the last 7 days');
        });

        it('marks a user or an IP failing again and again, and needs a look then', async () => {
            queryAll.mockResolvedValue([
                ...Array.from({ length: 5 }, (unused, index) => login('a' + index, '005000000000001', 'Invalid Password', '9.9.9.' + index)),
                ...Array.from({ length: 5 }, (unused, index) => login('b' + index, '00500000000000' + index, 'Invalid Password', '2.2.2.2')),
                login('c', '005000000000009', 'Password Lockout', '3.3.3.3')
            ]);
            queryCount.mockResolvedValue(400);
            getRecordNames.mockResolvedValue(new Map());

            const loaded = await failedLogins.load(ACME);

            expect(loaded.items.filter((item) => item.isStuck).map((item) => item.id)).toEqual(['a0', 'a1', 'a2', 'a3', 'a4', 'b0', 'b1', 'b2', 'b3', 'b4']);
            expect(loaded.items[0].user).toBe('005000000000001');
            expect(failedLogins.summarize({ ...loaded, total: 11 })).toEqual({
                value: 11,
                caption: 'of 11 logins in the last 7 days, 10 from a user or IP failing again and again',
                severity: ALERT
            });
            expect(failedLogins.summarize({ items: [], total: 3 }).severity).toBe(CLEAR);
        });
    });

    describe('setup changes', () => {
        it('lists the changes of the days, the ones made through Login-As marked', async () => {
            queryAll.mockResolvedValue([
                { Id: '0Ym1', Action: 'changedPassword', Section: 'Manage Users', Display: 'Changed password for Bob', CreatedDate: '2026-10-12T10:00:00.000Z', CreatedBy: { Name: 'Ann' }, DelegateUser: null },
                { Id: '0Ym2', Action: 'PermSetAssign', Section: 'Manage Users', Display: null, CreatedDate: '2026-10-11T10:00:00.000Z', CreatedBy: { Name: 'Bob' }, DelegateUser: 'admin@acme.com' }
            ]);

            const loaded = await setupChanges.load(ACME);

            expect(queryAll.mock.calls[0][1]).toContain('FROM SetupAuditTrail WHERE CreatedDate = LAST_N_DAYS:7 ORDER BY CreatedDate DESC');
            expect(loaded.items[1]).toEqual({
                id: '0Ym2', when: '2026-10-11T10:00:00.000Z', user: 'Bob', section: 'Manage Users', action: 'PermSetAssign',
                change: 'PermSetAssign', delegate: 'admin@acme.com', isStuck: true
            });
            expect(loaded.items[0].isStuck).toBe(false);
            expect(setupChanges.summarize(loaded)).toEqual({ value: 2, caption: 'in the last 7 days, 1 through Login-As', severity: INFO });
        });
    });

    describe('threats detected', () => {
        const invalidType = () => Object.assign(new Error('sObject type is not supported'), { errorCode: 'INVALID_TYPE' });

        it('reads every store the org has, passing over the ones it does not know', async () => {
            queryAll.mockImplementation((session, soql) => {
                if(soql.includes('FROM SessionHijackingEventStore')){
                    return Promise.resolve([{ Id: '0a1', EventDate: '2026-10-10T10:00:00.000Z', Username: 'ann@acme.com', Score: 0.9, SourceIp: '1.1.1.1', Summary: 'New browser' }]);
                }
                if(soql.includes('FROM ReportAnomalyEventStore')){
                    return Promise.resolve([{ Id: null, EventIdentifier: 'e2', EventDate: '2026-10-12T10:00:00.000Z', Username: 'bob@acme.com', Score: 0.7, SourceIp: null, Summary: 'Big export' }]);
                }
                return Promise.reject(invalidType());
            });

            const loaded = await threatDetection.load(ACME);

            expect(queryAll).toHaveBeenCalledTimes(4);
            expect(queryAll.mock.calls[0][1]).toBe(
                'SELECT Id, EventIdentifier, EventDate, Username, Score, SourceIp, Summary FROM SessionHijackingEventStore WHERE EventDate = LAST_N_DAYS:30 ORDER BY EventDate DESC LIMIT 2000'
            );
            expect(loaded.items).toEqual([
                { id: 'e2', when: '2026-10-12T10:00:00.000Z', threat: 'Report anomaly', user: 'bob@acme.com', score: 0.7, sourceIp: '', summary: 'Big export' },
                { id: '0a1', when: '2026-10-10T10:00:00.000Z', threat: 'Session hijacking', user: 'ann@acme.com', score: 0.9, sourceIp: '1.1.1.1', summary: 'New browser' }
            ]);
            expect(threatDetection.summarize(loaded)).toEqual({ value: 2, caption: 'threats in the last 30 days', severity: ALERT });
            expect(threatDetection.summarize({ items: [] })).toEqual({ value: 0, caption: 'threats in the last 30 days', severity: CLEAR });
        });

        it('is not in an org that knows none of the stores', async () => {
            queryAll.mockImplementation(() => Promise.reject(invalidType()));

            await expect(threatDetection.load(ACME)).rejects.toMatchObject({ errorCode: 'INVALID_TYPE' });
            expect(typeof threatDetection.requires).toBe('string');
        });

        it('fails on an error that is not the store missing', async () => {
            queryAll.mockImplementation((session, soql) => {
                if(soql.includes('ApiAnomaly')){
                    return Promise.reject(Object.assign(new Error('No such column'), { errorCode: 'INVALID_FIELD' }));
                }
                return Promise.resolve([]);
            });

            await expect(threatDetection.load(ACME)).rejects.toThrow('No such column');
        });
    });

    describe('transaction security policies', () => {
        it('lists the policies, the enabled ones first, and counts them', async () => {
            //The label field of a policy is named so in the API.
            /* eslint-disable inclusive-language/use-inclusive-words */
            queryAll.mockResolvedValue([
                { Id: '0w1', DeveloperName: 'Block_exports', MasterLabel: 'Block exports', State: 'Disabled', Type: 'CustomConditionBuilderPolicy', EventName: 'ReportEvent', LastModifiedDate: '2026-10-01T00:00:00.000Z', LastModifiedBy: { Name: 'Ann' } },
                { Id: '0w2', DeveloperName: 'Mfa_api', MasterLabel: null, State: 'Enabled', Type: 'CustomApexPolicy', EventName: 'ApiEvent', LastModifiedDate: '2026-10-02T00:00:00.000Z', LastModifiedBy: null }
            ]);
            /* eslint-enable inclusive-language/use-inclusive-words */

            const loaded = await securityPolicies.load(ACME);

            expect(queryAll.mock.calls[0][1]).toContain('FROM TransactionSecurityPolicy');
            expect(loaded.items).toEqual([
                { id: '0w2', name: 'Mfa_api', label: 'Mfa_api', event: 'ApiEvent', kind: 'Apex', state: 'Enabled', modifiedBy: '', modified: '2026-10-02T00:00:00.000Z' },
                { id: '0w1', name: 'Block_exports', label: 'Block exports', event: 'ReportEvent', kind: 'Condition builder', state: 'Disabled', modifiedBy: 'Ann', modified: '2026-10-01T00:00:00.000Z' }
            ]);
            expect(securityPolicies.summarize(loaded)).toEqual({ value: 1, caption: 'enabled, of 2 policies', severity: INFO });
        });
    });

    describe('log files to download', () => {
        it('lists every file of the days and downloads one', async () => {
            const file = { Id: '0AT1', EventType: 'Login', LogDate: '2026-10-12T00:00:00.000+0000', Interval: 'Daily', LogFileLength: 2049, Sequence: 0 };
            getEventLogFiles.mockResolvedValue([file, { ...file, Id: '0AT2', EventType: 'ApiTotalUsage', LogFileLength: 0 }]);

            const loaded = await logFiles.load(ACME);

            expect(getEventLogFiles).toHaveBeenCalledWith(ACME, { days: 7, apiVersion: MONITOR_API_VERSION });
            expect(loaded.items[0]).toEqual({ id: '0AT1', when: file.LogDate, eventType: 'Login', interval: 'Daily', size: 3, file });
            expect(loaded.items[1].size).toBe(0);
            expect(logFiles.summarize(loaded)).toEqual({ value: 2, caption: 'event types, 2 files in the last 7 days', severity: INFO });

            await logFiles.actions[0].run(ACME, loaded.items[0]);
            expect(downloadEventLogFile).toHaveBeenCalledWith(ACME, file, MONITOR_API_VERSION);
        });
    });

    describe('the monitors of an event type', () => {
        const readOf = (rows, files = 2, read = files) => ({
            rows,
            files: Array.from({ length: files }, (unused, index) => ({ Id: 'f' + index })),
            read: Array.from({ length: read }, (unused, index) => ({ Id: 'f' + index })),
            skipped: []
        });

        beforeEach(() => {
            getRecordNames.mockResolvedValue(new Map([['005000000000001', 'Ann'], ['00O000000000001', 'Pipeline']]));
        });

        it('read the daily files of their type within the budget', async () => {
            readEventLogRows.mockResolvedValue(readOf([]));

            await apiUsage.load(ACME);

            expect(readEventLogRows).toHaveBeenCalledWith(ACME, {
                eventType: 'ApiTotalUsage', days: 7, interval: 'Daily', maxFiles: MAX_LOG_FILES, maxBytes: MAX_LOG_BYTES, apiVersion: MONITOR_API_VERSION
            });
        });

        it('say so when the org has no file of their type, and when some were too big', () => {
            expect(apexExceptions.summarize({ items: [], total: 0, files: 0, read: 0 })).toEqual({
                value: 0, caption: 'no ApexUnexpectedException log file in the last 7 days', severity: INFO
            });
            expect(apexExceptions.summarize({ items: [{}], total: 1, files: 3, read: 2 })).toEqual({
                value: 1, caption: 'uncaught in the last 7 days, 1 log file too big to read here', severity: ALERT
            });
        });

        it('add up the API calls per day, user, client, API and object', async () => {
            const call = (extra) => ({
                TIMESTAMP_DERIVED: '2026-10-12T10:00:00.000Z', USER_ID: '005000000000001', CLIENT_NAME: 'Data Loader',
                API_FAMILY: 'SOAP', ENTITY_NAME: 'Account', COUNTS_AGAINST_API_LIMIT: '1', STATUS_CODE: '200', ...extra
            });
            readEventLogRows.mockResolvedValue(readOf([
                call(),
                call({ STATUS_CODE: '500' }),
                call({ COUNTS_AGAINST_API_LIMIT: '0' }),
                call({ CLIENT_NAME: '', CONNECTED_APP_ID: '0H4A', API_FAMILY: 'REST', ENTITY_NAME: '' })
            ]));

            const loaded = await apiUsage.load(ACME);
            const day = dayOf('2026-10-12T10:00:00.000Z');

            expect(getRecordNames).toHaveBeenCalledWith(ACME, 'User', expect.arrayContaining(['005000000000001']), { apiVersion: MONITOR_API_VERSION });
            expect(loaded.items).toEqual([
                { id: day + '|Ann|Data Loader|SOAP|Account', day, user: 'Ann', client: 'Data Loader', api: 'SOAP', object: 'Account', calls: 3, counted: 2, failed: 1 },
                { id: day + '|Ann|0H4A|REST|', day, user: 'Ann', client: '0H4A', api: 'REST', object: '', calls: 1, counted: 1, failed: 0 }
            ]);
            expect(loaded.total).toBe(4);
            expect(apiUsage.summarize(loaded)).toEqual({ value: 4, caption: 'in the last 7 days, the most through Data Loader', severity: INFO });
            expect(apiUsage.groupings[0].sum(loaded.items[0])).toBe(3);
        });

        it('list the Apex exceptions nothing caught, the latest first', async () => {
            readEventLogRows.mockResolvedValue(readOf([
                { REQUEST_ID: 'r1', TIMESTAMP_DERIVED: '2026-10-11T10:00:00.000Z', USER_ID: '005000000000001AAA', EXCEPTION_TYPE: 'System.NullPointerException', EXCEPTION_MESSAGE: 'Attempt to de-reference a null object', STACK_TRACE: 'Class.Billing.run: line 12, column 1', EXCEPTION_CATEGORY: 'APEX_CODE' },
                { REQUEST_ID: 'r2', TIMESTAMP_DERIVED: '2026-10-12T10:00:00.000Z', USER_ID: '', EXCEPTION_TYPE: '', EXCEPTION_MESSAGE: '', STACK_TRACE: '', EXCEPTION_CATEGORY: '' }
            ]));

            const loaded = await apexExceptions.load(ACME);

            expect(loaded.items).toEqual([
                { id: 'r2|1', when: '2026-10-12T10:00:00.000Z', user: '', exception: 'Unknown', message: '', origin: 'Unknown', category: '' },
                { id: 'r1|0', when: '2026-10-11T10:00:00.000Z', user: 'Ann', exception: 'System.NullPointerException', message: 'Attempt to de-reference a null object', origin: 'Class.Billing.run', category: 'APEX_CODE' }
            ]);
            expect(apexExceptions.summarize(loaded)).toEqual({ value: 2, caption: 'uncaught in the last 7 days', severity: ALERT });
        });

        it('keep the Apex executions over five seconds, the longest first', async () => {
            readEventLogRows.mockResolvedValue(readOf([
                { REQUEST_ID: 'r1', TIMESTAMP_DERIVED: '2026-10-12T10:00:00.000Z', ENTRY_POINT: 'BillingController.save', EXEC_TIME: '6234', CPU_TIME: '4100', NUMBER_SOQL_QUERIES: '40', CALLOUT_TIME: '' },
                { REQUEST_ID: 'r2', TIMESTAMP_DERIVED: '2026-10-12T11:00:00.000Z', ENTRY_POINT: 'Quick', EXEC_TIME: '120' },
                { REQUEST_ID: 'r3', TIMESTAMP_DERIVED: '2026-10-12T12:00:00.000Z', ENTRY_POINT: 'Sync.run', EXEC_TIME: '12000', CPU_TIME: '900', NUMBER_SOQL_QUERIES: '2', CALLOUT_TIME: '11000' }
            ]));

            const loaded = await slowApex.load(ACME);

            expect(loaded.items).toEqual([
                { id: 'r3|1', when: '2026-10-12T12:00:00.000Z', entryPoint: 'Sync.run', seconds: 12, cpu: 900, soql: 2, callouts: 11000 },
                { id: 'r1|0', when: '2026-10-12T10:00:00.000Z', entryPoint: 'BillingController.save', seconds: 6.2, cpu: 4100, soql: 40, callouts: 0 }
            ]);
            expect(slowApex.summarize(loaded)).toEqual({ value: 2, caption: 'of 3 executions ran over 5 s', severity: ALERT });
        });

        it('list the reports exported with the names of the report and the user', async () => {
            readEventLogRows.mockResolvedValue(readOf([
                { REQUEST_ID: 'r1', TIMESTAMP_DERIVED: '2026-10-12T10:00:00.000Z', USER_ID: '005000000000001', REPORT_ID: '00O000000000001', CLIENT_INFO: 'Browser', CLIENT_IP: '1.1.1.1' }
            ]));

            const loaded = await reportExports.load(ACME);

            expect(getRecordNames).toHaveBeenCalledWith(ACME, 'Report', ['00O000000000001'], { apiVersion: MONITOR_API_VERSION });
            expect(loaded.items).toEqual([
                { id: 'r1|0', when: '2026-10-12T10:00:00.000Z', user: 'Ann', report: 'Pipeline', client: 'Browser', sourceIp: '1.1.1.1' }
            ]);
            expect(reportExports.summarize(loaded)).toEqual({ value: 1, caption: 'in the last 7 days, by 1 user', severity: INFO });
        });
    });

    describe('slow Lightning pages', () => {
        it('adds up the usage per page, the slowest first, and counts the slow ones', async () => {
            queryAll.mockResolvedValue([
                { PageName: 'Home', views: 900, eptSum: 2400000, eptCount: 1000, users: 40 },
                { PageName: 'Account record', views: 300, eptSum: 1830000, eptCount: 300, users: 25 },
                { PageName: null, views: 5, eptSum: 0, eptCount: 0, users: 1 }
            ]);

            const loaded = await slowPages.load(ACME);

            expect(queryAll.mock.calls[0][1]).toBe(
                'SELECT PageName, SUM(TotalCount) views, SUM(SumEPT) eptSum, SUM(RecordCountEPT) eptCount, COUNT_DISTINCT(UserId) users FROM LightningUsageByPageMetrics WHERE MetricsDate = LAST_N_DAYS:30 GROUP BY PageName ORDER BY SUM(TotalCount) DESC LIMIT 2000'
            );
            expect(loaded.items).toEqual([
                { id: 'Account record', page: 'Account record', views: 300, users: 25, seconds: 6.1, speed: 'Over 5 s', isStuck: true },
                { id: 'Home', page: 'Home', views: 900, users: 40, seconds: 2.4, speed: 'Under 3 s', isStuck: false },
                { id: 'Unknown', page: 'Unknown', views: 5, users: 1, seconds: null, speed: 'No timing', isStuck: false }
            ]);
            expect(slowPages.summarize(loaded)).toEqual({ value: 1, caption: 'of 3 pages viewed in the last 30 days, the slowest at 6.1 s', severity: ALERT });
            expect(slowPages.summarize({ items: [] })).toEqual({ value: 0, caption: 'of 0 pages viewed in the last 30 days', severity: CLEAR });
        });
    });

    describe('the actions of the transaction security policies', () => {
        const [enable, disable] = securityPolicies.actions;
        const policy = { id: '0w1', label: 'Block exports', event: 'ReportEvent', state: 'Disabled' };

        it('offers to enable a disabled policy and to disable an enabled one', () => {
            expect(enable.isAvailable(policy)).toBe(true);
            expect(disable.isAvailable(policy)).toBe(false);
            expect(enable.isAvailable({ ...policy, state: 'Enabled' })).toBe(false);
            expect(disable.isAvailable({ ...policy, state: 'Enabled' })).toBe(true);
        });

        it('asks before changing the policy, and reads the policies again after', async () => {
            updateRecord.mockResolvedValue(null);

            expect(enable.confirm(policy)).toMatchObject({ title: 'Enable Block exports?', confirmLabel: 'Enable', variant: 'destructive' });
            expect(enable.reloads).toBe(true);
            await enable.run(ACME, policy);
            await disable.run(ACME, policy);

            expect(updateRecord).toHaveBeenNthCalledWith(1, ACME, 'TransactionSecurityPolicy', '0w1', { State: 'Enabled' }, { apiVersion: MONITOR_API_VERSION });
            expect(updateRecord).toHaveBeenNthCalledWith(2, ACME, 'TransactionSecurityPolicy', '0w1', { State: 'Disabled' }, { apiVersion: MONITOR_API_VERSION });
        });
    });

    describe('the Event Manager', () => {
        const settings = (xml) => {
            const document = new DOMParser().parseFromString(
                '<records xmlns="http://soap.sforce.com/2006/04/metadata">' + xml + '</records>', 'text/xml'
            );
            return [document.documentElement];
        };

        it('reads the real-time event settings, the ones on first', async () => {
            readMetadata.mockResolvedValue(settings(
                '<fullName>RealTimeEvent</fullName>' +
                '<realTimeEvents><entityName>LoginEventStream</entityName><isEnabled>false</isEnabled></realTimeEvents>' +
                '<realTimeEvents><entityName>LogoutEventStream</entityName><isEnabled>false</isEnabled></realTimeEvents>' +
                '<realTimeEvents><entityName>ApiEvent</entityName><isEnabled>true</isEnabled></realTimeEvents>'
            ));

            const loaded = await realTimeEvents.load(ACME);

            expect(readMetadata).toHaveBeenCalledWith(ACME, MONITOR_API_VERSION, 'RealTimeEventSettings', ['RealTimeEvent']);
            expect(loaded.items).toEqual([
                { id: 'ApiEvent', entity: 'ApiEvent', event: 'Api event', capability: 'Storage', state: 'On', isEnabled: true },
                { id: 'LoginEventStream', entity: 'LoginEventStream', event: 'Login event', capability: 'Streaming', state: 'Off', isEnabled: false },
                { id: 'LogoutEventStream', entity: 'LogoutEventStream', event: 'Logout event', capability: 'Streaming', state: 'Off', isEnabled: false }
            ]);
            expect(realTimeEvents.summarize(loaded)).toEqual({ value: 1, caption: 'on, of 3 settings', severity: INFO });
        });

        it('lists nothing for an org whose settings are empty', async () => {
            readMetadata.mockResolvedValue([]);

            expect((await realTimeEvents.load(ACME)).items).toEqual([]);
        });

        it('turns a setting on or off after asking, and reads the settings again', async () => {
            const [turnOn, turnOff] = realTimeEvents.actions;
            const stream = { id: 'LoginEventStream', entity: 'LoginEventStream', event: 'Login event', capability: 'Streaming', isEnabled: false };
            updateMetadata.mockResolvedValue();

            expect(turnOn.isAvailable(stream)).toBe(true);
            expect(turnOff.isAvailable(stream)).toBe(false);
            expect(turnOn.confirm(stream).title).toBe('Turn on the streaming of Login event?');
            expect(turnOff.confirm({ ...stream, capability: 'Storage' }).title).toBe('Turn off the storage of Login event?');
            await turnOn.run(ACME, stream);

            expect(updateMetadata).toHaveBeenCalledWith(ACME, MONITOR_API_VERSION, 'RealTimeEventSettings',
                '<met:fullName>RealTimeEvent</met:fullName><met:realTimeEvents><met:entityName>LoginEventStream</met:entityName><met:isEnabled>true</met:isEnabled></met:realTimeEvents>');
            expect(turnOn.reloads).toBe(true);
        });

        it('names an event in words', () => {
            expect(realTimeEventLabel('LoginEventStream')).toBe('Login event');
            expect(realTimeEventLabel('ApiAnomalyEventStore')).toBe('Api anomaly event');
            expect(realTimeEventLabel('LightningURIEvent')).toBe('Lightning uri event');
        });
    });

    describe('live events', () => {
        const SOBJECTS = [
            { name: 'Account', label: 'Account', queryable: true },
            { name: 'Order_Event__e', label: 'Order Event', queryable: false },
            { name: 'BatchApexErrorEvent', label: 'Batch Apex Error Event', queryable: false },
            { name: 'AccountChangeEvent', label: 'Account Change Event', queryable: false },
            { name: 'LoginEventStream', label: 'Login Event Stream', queryable: false },
            { name: 'LoginEvent', label: 'Login Event', queryable: true }
        ];

        it('lists the channels of the org, the real-time streams first', () => {
            expect(channelsOf(SOBJECTS)).toEqual([
                { id: '/event/LoginEventStream', name: 'LoginEventStream', label: 'Login Event Stream', kind: 'Real-time stream' },
                { id: '/event/BatchApexErrorEvent', name: 'BatchApexErrorEvent', label: 'Batch Apex Error Event', kind: 'Platform event' },
                { id: '/event/Order_Event__e', name: 'Order_Event__e', label: 'Order Event', kind: 'Platform event' },
                { id: '/data/AccountChangeEvent', name: 'AccountChangeEvent', label: 'Account Change Event', kind: 'Change event' },
                { id: '/data/ChangeEvents', name: 'ChangeEvents', label: 'Every change event', kind: 'Change event' }
            ]);
            expect(channelsOf([{ name: 'Order_Event__e', queryable: false }]).map((channel) => channel.id)).toEqual(['/event/Order_Event__e']);
        });

        it('opens on the live view and counts the channels on its card', async () => {
            describeGlobal.mockResolvedValue({ sobjects: SOBJECTS });

            const loaded = await liveEvents.load(ACME);

            expect(liveEvents.view).toBe('live');
            expect(describeGlobal).toHaveBeenCalledWith(ACME, MONITOR_API_VERSION);
            expect(liveEvents.summarize(loaded)).toEqual({
                value: 5,
                caption: 'channels: 2 platform events, 2 change events, 1 real-time stream',
                severity: INFO
            });
        });
    });

    describe('what listening may take of the org', () => {
        const PLATFORM = { id: '/event/Order_Event__e', kind: 'Platform event' };
        const deliveries = (Max, Remaining) => ({ DailyDeliveredPlatformEvents: { Max, Remaining } });

        it('lets a listening last two hours at most, thirty minutes unless picked otherwise', () => {
            expect(LISTEN_MINUTES).toEqual([5, 15, 30, 60, 120]);
            expect(DEFAULT_LISTEN_MINUTES).toBe(30);
            expect(liveEvents.listen).toMatchObject({ minutes: LISTEN_MINUTES, defaultMinutes: 30, maxEvents: MAX_LISTEN_EVENTS, alertPercent: 80 });
            expect(liveEvents.listen.budget).toBe(listenBudget);
        });

        it('counts nothing for a real-time stream, and reads no limit for it', async () => {
            expect(await listenBudget(ACME, { id: '/event/LoginEventStream', kind: 'Real-time stream' })).toEqual({ counted: false, maxEvents: null });
            expect(getLimits).not.toHaveBeenCalled();
        });

        it('takes a tenth of the deliveries left at most, and never more than its cap', async () => {
            getLimits.mockResolvedValue(deliveries(50000, 48000));
            expect(await listenBudget(ACME, PLATFORM)).toEqual({
                counted: true, used: 2000, max: 50000, remaining: 48000, percent: 4, maxEvents: 1000
            });
            expect(getLimits).toHaveBeenCalledWith(ACME, MONITOR_API_VERSION);

            getLimits.mockResolvedValue(deliveries(10000, 3000));
            expect((await listenBudget(ACME, PLATFORM)).maxEvents).toBe(300);

            getLimits.mockResolvedValue(deliveries(10000, 9));
            expect(await listenBudget(ACME, PLATFORM)).toMatchObject({ percent: 100, maxEvents: 0 });
        });

        it('keeps its cap when the org reports no delivery limit', async () => {
            getLimits.mockResolvedValue({});
            expect(await listenBudget(ACME, PLATFORM)).toEqual({ counted: true, maxEvents: MAX_LISTEN_EVENTS });
        });
    });
});
