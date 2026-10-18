import { createElement } from 'lwc';
import CompareLogs from 'sfdl/compareLogs';
import { showToastEvent } from 'sfdl/utils';

jest.mock('sfdl/utils', () => ({ showToastEvent: jest.fn() }));

const ACME = {
    instanceUrl: 'https://acme.my.salesforce.com',
    authToken: 'sid-acme',
    queryWhere: "WHERE Status = 'Success'"
};
const GLOBEX = {
    instanceUrl: 'https://globex.my.salesforce.com',
    authToken: 'sid-globex'
};
const INITECH = {
    instanceUrl: 'https://initech.my.salesforce.com',
    authToken: 'sid-initech'
};
const ORGS = [
    { label: 'https://acme.my.salesforce.com', value: 'sid-acme' },
    { label: 'https://globex.my.salesforce.com', value: 'sid-globex' },
    { label: 'https://initech.my.salesforce.com', value: 'sid-initech' }
];
const ACME_SESSION = {
    instanceUrl: ACME.instanceUrl,
    authToken: ACME.authToken
};

// The bodies are cached for the whole session, every test gets logs of its own.
let logCount = 0;
function newLog(name) {
    logCount++;
    const id = '07LT' + logCount;
    return {
        id,
        name: name || 'log ' + id,
        attributes: {
            url: '/services/data/v51.0/tooling/sobjects/ApexLog/' + id
        }
    };
}

function wait(milliseconds = 0) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function mockOrgs({ bodies = {}, failing = [], delays = {} } = {}) {
    global.fetch = jest.fn((url) => {
        const logId = Object.keys(bodies).find((id) =>
            url.endsWith('/' + id + '/Body')
        );
        if (!logId) {
            return Promise.resolve({
                status: 200,
                json: () => Promise.resolve({ done: true, records: [] })
            });
        }
        const response = failing.includes(logId)
            ? {
                  status: 404,
                  statusText: 'Not Found',
                  json: () =>
                      Promise.resolve([{ message: 'The log was deleted' }])
              }
            : { status: 200, text: () => Promise.resolve(bodies[logId]) };
        return new Promise((resolve) =>
            setTimeout(() => resolve(response), delays[logId] || 0)
        );
    });
    chrome.runtime.sendMessage.mockImplementation(() =>
        Promise.resolve({ apexLogList: [] })
    );
}

async function createCompareLogs(properties = {}) {
    const element = createElement('sfdl-compare-logs', { is: CompareLogs });
    Object.assign(element, {
        orgs: ORGS,
        sessionInformation: ACME,
        height: 600,
        ...properties
    });
    document.body.appendChild(element);
    await wait();
    await wait();
    return element;
}

const sideList = (element, side) =>
    element.shadowRoot.querySelector(
        `.sfdl-compare-logs__${side}-panel sfdl-compare-log-list`
    );
const orgPicker = (element, side) =>
    element.shadowRoot.querySelector(
        `.sfdl-compare-logs__${side}-panel sfdl-combobox`
    );
const panel = (element, side) =>
    element.shadowRoot.querySelector(`.sfdl-compare-logs__${side}-panel`);
const diffViewer = (element) =>
    element.shadowRoot.querySelector('sfdl-diff-viewer');
const filterPill = (element, name) =>
    element.shadowRoot
        .querySelector('sfdl-log-manipulation-menu')
        .shadowRoot.querySelector(
            `.sfdl-log-filter__pill[data-name="${name}"]`
        );
const bodyDownloads = () =>
    fetch.mock.calls.map(([url]) => url).filter((url) => url.endsWith('/Body'));

async function pickOrg(element, side, instanceUrl) {
    orgPicker(element, side).dispatchEvent(
        new CustomEvent('change', { detail: { value: instanceUrl } })
    );
    await wait();
}

async function selectLog(element, side, log) {
    sideList(element, side).dispatchEvent(
        new CustomEvent('logselect', { detail: { log, side } })
    );
    await wait();
}

// Both orgs picked, ready to pick a log on each side.
async function ready(properties) {
    const element = await createCompareLogs(properties);
    await pickOrg(element, 'right', GLOBEX.instanceUrl);
    return element;
}

describe('sfdl-compare-logs', () => {
    beforeEach(() => {
        mockOrgs();
    });

    describe('layout', () => {
        it('lays out the logs of each org around the diff', async () => {
            const element = await createCompareLogs();
            const columns = [
                ...element.shadowRoot.querySelector('.sfdl-compare-logs__body')
                    .children
            ].map((column) => column.className);

            expect(columns).toEqual([
                'sfdl-compare-logs__left-panel',
                'sfdl-compare-logs__diff',
                'sfdl-compare-logs__right-panel'
            ]);
            expect(panel(element, 'left').side).toBe('left');
            expect(panel(element, 'right').side).toBe('right');
            expect(sideList(element, 'left').side).toBe('left');
            expect(sideList(element, 'right').side).toBe('right');
        });

        it('shows neither the filters nor the bar before two logs are picked', async () => {
            const element = await ready();
            await selectLog(element, 'left', newLog());

            expect(
                element.shadowRoot.querySelector('.sfdl-compare-logs__filters')
            ).toBeNull();
            expect(diffViewer(element).hideEmptySummary).toBe(true);
        });

        it('puts the filters in a row of their own above the diff', async () => {
            const [left, right] = [newLog(), newLog()];
            mockOrgs({ bodies: { [left.id]: 'a', [right.id]: 'b' } });
            const element = await ready();
            await selectLog(element, 'left', left);
            await selectLog(element, 'right', right);
            await wait();
            const menu = element.shadowRoot.querySelector(
                'sfdl-log-manipulation-menu'
            );

            expect(menu.parentElement.className).toBe(
                'sfdl-compare-logs__filters'
            );
            expect(menu.slot).toBe('');
            expect(menu.options.map(({ name }) => name)).toEqual([
                'methodEntryExitCodeUnitStartedFinished2Hierarchy',
                'removeHeapAllocateAndStatementExecute',
                'removeFlowNoise',
                'ignoreTimestamps',
                'ignoreIdsAndAddresses',
                'ignoreLineNumbers'
            ]);
        });

        it('takes the height it is given', async () => {
            const element = await createCompareLogs({ height: 640 });

            expect(
                element.shadowRoot.querySelector('.sfdl-compare-logs').style
                    .height
            ).toBe('640px');
        });

        it('starts the left side on the org of the header, without its filter', async () => {
            const element = await createCompareLogs();

            expect(orgPicker(element, 'left').value).toBe(ACME.instanceUrl);
            expect(sideList(element, 'left').sessionInformation).toEqual(
                ACME_SESSION
            );
            expect(
                sideList(element, 'right').sessionInformation
            ).toBeUndefined();
            expect(orgPicker(element, 'right').value).toBeUndefined();
        });

        it('takes the header org for the left side when it comes later', async () => {
            const element = await createCompareLogs({
                sessionInformation: undefined
            });

            element.sessionInformation = ACME;
            await wait();

            expect(orgPicker(element, 'left').value).toBe(ACME.instanceUrl);
        });

        it('lists the logs of the org picked on each side', async () => {
            const element = await ready();

            expect(sideList(element, 'right').sessionInformation).toEqual(
                GLOBEX
            );
            expect(orgPicker(element, 'right').value).toBe(
                GLOBEX.instanceUrl
            );
        });

        it('offers each side the orgs the other side has not taken', async () => {
            const element = await ready();
            const values = (side) =>
                orgPicker(element, side).options.map(({ value }) => value);

            expect(values('left')).toEqual([
                ACME.instanceUrl,
                INITECH.instanceUrl
            ]);
            expect(values('right')).toEqual([
                GLOBEX.instanceUrl,
                INITECH.instanceUrl
            ]);
        });

        it('ignores an org the other side has taken', async () => {
            const element = await ready();

            await pickOrg(element, 'left', GLOBEX.instanceUrl);

            expect(orgPicker(element, 'left').value).toBe(ACME.instanceUrl);
        });

        it('leaves the left side empty when the right side has the org of the header', async () => {
            const element = await createCompareLogs({
                sessionInformation: undefined
            });
            await pickOrg(element, 'right', ACME.instanceUrl);

            element.sessionInformation = ACME;
            await wait();

            expect(orgPicker(element, 'left').value).toBeUndefined();
        });

        it('keeps its orgs when the header org changes', async () => {
            const element = await ready();

            element.sessionInformation = GLOBEX;
            await wait();

            expect(orgPicker(element, 'left').value).toBe(ACME.instanceUrl);
        });
    });

    describe('picking logs', () => {
        it('asks for a log on each side', async () => {
            const element = await ready();

            expect(diffViewer(element).emptyMessage).toBe(
                'Pick a log on each side to compare them.'
            );

            await selectLog(element, 'left', newLog());

            expect(diffViewer(element).emptyMessage).toBe(
                'Now pick the log for the right side.'
            );
        });

        it('compares a log of each org and names the org of each side', async () => {
            const [left, right] = [
                newLog('Jane Roe | Api'),
                newLog('John Doe | Api')
            ];
            mockOrgs({
                bodies: { [left.id]: 'left body', [right.id]: 'right body' }
            });
            const element = await ready();

            await selectLog(element, 'left', left);
            await selectLog(element, 'right', right);
            await wait();

            expect(sideList(element, 'left').leftLogId).toBe(left.id);
            expect(sideList(element, 'right').rightLogId).toBe(right.id);
            expect(diffViewer(element).leftLabel).toBe('acme · Jane Roe | Api');
            expect(diffViewer(element).rightLabel).toBe(
                'globex · John Doe | Api'
            );
            expect(diffViewer(element).leftContent).toBe('left body');
            expect(bodyDownloads()).toEqual([
                'https://acme.my.salesforce.com' +
                    left.attributes.url +
                    '/Body',
                'https://globex.my.salesforce.com' +
                    right.attributes.url +
                    '/Body'
            ]);
        });

        it('takes a log off its side when it is clicked again', async () => {
            const log = newLog();
            const element = await ready();

            await selectLog(element, 'left', log);
            await selectLog(element, 'left', log);

            expect(sideList(element, 'left').leftLogId).toBeUndefined();
        });

        it('takes the log off a side when its org changes', async () => {
            const element = await ready();
            await selectLog(element, 'left', newLog());

            await pickOrg(element, 'left', INITECH.instanceUrl);

            expect(sideList(element, 'left').leftLogId).toBeUndefined();
        });
    });

    describe('comparing the bodies', () => {
        it('drops the timestamps and the ids so two runs compare line by line', async () => {
            const [left, right] = [newLog(), newLog()];
            mockOrgs({
                bodies: {
                    [left.id]:
                        '10:00:00.1 (1)|USER_DEBUG|[1]|DEBUG|001xx000003DGbYAAW',
                    [right.id]:
                        '11:30:00.9 (999)|USER_DEBUG|[1]|DEBUG|001xx000004XyZaAAW'
                }
            });
            const element = await ready();

            await selectLog(element, 'left', left);
            await selectLog(element, 'right', right);
            await wait();

            expect(diffViewer(element).leftContent).toBe(
                'USER_DEBUG|[1]|DEBUG|001<id>'
            );
            expect(diffViewer(element).rightContent).toBe(
                'USER_DEBUG|[1]|DEBUG|001<id>'
            );
            expect(diffViewer(element).language).toBe('apexlog');
        });

        it('starts downloading the first log before the second one is picked', async () => {
            const log = newLog();
            mockOrgs({ bodies: { [log.id]: 'body' } });
            const element = await ready();

            await selectLog(element, 'left', log);

            expect(bodyDownloads()).toHaveLength(1);
            expect(diffViewer(element).leftContent).toBeUndefined();
        });

        it('shows the spinner while the bodies download', async () => {
            const [left, right] = [newLog(), newLog()];
            mockOrgs({
                bodies: { [left.id]: 'a', [right.id]: 'b' },
                delays: { [right.id]: 30 }
            });
            const element = await ready();

            await selectLog(element, 'left', left);
            await selectLog(element, 'right', right);
            expect(diffViewer(element).loading).toBe(true);
            expect(diffViewer(element).emptyMessage).toBe(
                'Downloading the two logs...'
            );

            await wait(50);
            expect(diffViewer(element).loading).toBe(false);
        });

        it('downloads a log only once', async () => {
            const [left, first, second] = [newLog(), newLog(), newLog()];
            mockOrgs({
                bodies: { [left.id]: 'a', [first.id]: 'b', [second.id]: 'c' }
            });
            const element = await ready();

            await selectLog(element, 'left', left);
            await selectLog(element, 'right', first);
            await selectLog(element, 'right', second);
            await selectLog(element, 'right', first);
            await wait();

            expect(bodyDownloads()).toHaveLength(3);
            expect(diffViewer(element).rightContent).toBe('b');
        });

        it('filters both logs again when an option changes, without downloading them', async () => {
            const [left, right] = [newLog(), newLog()];
            const body = [
                '10:00:00.1 (1)|HEAP_ALLOCATE|[5]|Bytes:3',
                '10:00:00.2 (2)|USER_DEBUG|[6]|DEBUG|hello'
            ].join('\n');
            mockOrgs({ bodies: { [left.id]: body, [right.id]: body } });
            const element = await ready();
            await selectLog(element, 'left', left);
            await selectLog(element, 'right', right);
            await wait();

            expect(diffViewer(element).leftContent).toBe(
                'USER_DEBUG|[6]|DEBUG|hello'
            );

            ['removeHeapAllocateAndStatementExecute', 'ignoreTimestamps'].forEach(
                (name) => filterPill(element, name).click()
            );
            await wait();

            expect(diffViewer(element).leftContent).toBe(body);
            expect(bodyDownloads()).toHaveLength(2);
        });

        it('keeps the filters when the diff is built again for other logs', async () => {
            const [left, right, other] = [newLog(), newLog(), newLog()];
            const body = '10:00:00.2 (2)|USER_DEBUG|[6]|DEBUG|hello';
            mockOrgs({
                bodies: { [left.id]: body, [right.id]: body, [other.id]: body }
            });
            const element = await ready();
            await selectLog(element, 'left', left);
            await selectLog(element, 'right', right);
            await wait();
            filterPill(element, 'ignoreTimestamps').click();
            await wait();

            await selectLog(element, 'right', other);
            await wait();

            expect(diffViewer(element).rightContent).toBe(body);
            expect(
                element.shadowRoot
                    .querySelector('sfdl-log-manipulation-menu')
                    .options.find(({ name }) => name === 'ignoreTimestamps')
                    .checked
            ).toBe(false);
        });

        it('takes a log off and says why when it cannot be downloaded', async () => {
            const [left, right] = [newLog(), newLog()];
            mockOrgs({
                bodies: { [left.id]: 'a', [right.id]: 'b' },
                failing: [right.id]
            });
            const element = await ready();

            await selectLog(element, 'left', left);
            await selectLog(element, 'right', right);
            await wait();

            expect(showToastEvent).toHaveBeenCalledWith(
                'error',
                'The log could not be downloaded',
                'The log was deleted'
            );
            expect(sideList(element, 'right').rightLogId).toBeUndefined();
            expect(sideList(element, 'left').leftLogId).toBe(left.id);
            expect(diffViewer(element).loading).toBe(false);
        });

        it('shows the latest pick when an earlier download comes back late', async () => {
            const [left, slow, fast] = [newLog(), newLog(), newLog()];
            mockOrgs({
                bodies: {
                    [left.id]: 'a',
                    [slow.id]: 'slow',
                    [fast.id]: 'fast'
                },
                delays: { [slow.id]: 40 }
            });
            const element = await ready();

            await selectLog(element, 'left', left);
            await selectLog(element, 'right', slow);
            await selectLog(element, 'right', fast);
            await wait(60);

            expect(diffViewer(element).rightContent).toBe('fast');
        });

        it('empties the diff when a side is taken off', async () => {
            const [left, right] = [newLog(), newLog()];
            mockOrgs({ bodies: { [left.id]: 'a', [right.id]: 'b' } });
            const element = await ready();
            await selectLog(element, 'left', left);
            await selectLog(element, 'right', right);
            await wait();

            await selectLog(element, 'right', right);

            expect(diffViewer(element).leftContent).toBeUndefined();
            expect(diffViewer(element).rightContent).toBeUndefined();
        });
    });

    describe('the panels', () => {
        it('pick the org of each side in place of a title, with no swap', async () => {
            const element = await createCompareLogs();

            ['left', 'right'].forEach((side) => {
                expect(panel(element, side).title).toBeUndefined();
                expect(panel(element, side).subtitle).toBeUndefined();
                expect(orgPicker(element, side).slot).toBe('header');
                expect(orgPicker(element, side).side).toBe(side);
            });
            expect(panel(element, 'left').label).toBe('Log List');
            expect(panel(element, 'right').label).toBe('Log List');
            expect(orgPicker(element, 'left').label).toBe('Left org');
            expect(orgPicker(element, 'right').label).toBe('Right org');
            expect(
                element.shadowRoot.querySelector('.sfdl-swap-icon')
            ).toBeNull();
        });

        it('folds either side on its own', async () => {
            const element = await ready();

            panel(element, 'right')
                .shadowRoot.querySelector('.sfdl-side-panel__collapse')
                .click();
            await wait();

            const isFolded = (side) =>
                panel(element, side)
                    .shadowRoot.querySelector('.sfdl-side-panel__content')
                    .classList.contains('slds-hide');
            expect(isFolded('right')).toBe(true);
            expect(isFolded('left')).toBe(false);
        });
    });

    describe('reloading one side', () => {
        it('keeps the other side on screen while the new log downloads', async () => {
            const [left, first, second] = [newLog(), newLog(), newLog()];
            mockOrgs({
                bodies: { [left.id]: 'a', [first.id]: 'b', [second.id]: 'c' },
                delays: { [second.id]: 30 }
            });
            const element = await ready();
            await selectLog(element, 'left', left);
            await selectLog(element, 'right', first);
            await wait();

            await selectLog(element, 'right', second);

            expect(diffViewer(element).loading).toBe(false);
            expect(diffViewer(element).loadingSide).toBe('right');
            expect(diffViewer(element).sideLoadingMessage).toBe(
                'Downloading the right log...'
            );
            expect(diffViewer(element).leftContent).toBe('a');

            await wait(50);

            expect(diffViewer(element).loadingSide).toBeUndefined();
            expect(diffViewer(element).rightContent).toBe('c');
        });
    });

    describe('logs of the same org', () => {
        const ALPHA = newLog('Jane Roe | alpha');
        const BETA = newLog('Jane Roe | beta');
        const GAMMA = newLog('Jane Roe | gamma');
        const DELTA = newLog('Jane Roe | delta');
        const BODIES = {
            [ALPHA.id]: 'alpha body',
            [BETA.id]: 'beta body',
            [GAMMA.id]: 'gamma body',
            [DELTA.id]: 'delta body'
        };
        const sameOrgList = (element) =>
            element.shadowRoot.querySelector(
                '.sfdl-compare-logs__list-panel sfdl-compare-log-list'
            );
        const sameOrgPicker = (element) =>
            element.shadowRoot.querySelector(
                '.sfdl-compare-logs__list-panel sfdl-combobox'
            );
        const ticked = (element) => [
            sameOrgList(element).leftLogId,
            sameOrgList(element).rightLogId
        ];

        async function createSameOrg(properties = {}) {
            mockOrgs({ bodies: BODIES });
            return createCompareLogs({ scope: 'sameOrg', ...properties });
        }

        async function tick(element, log) {
            sameOrgList(element).dispatchEvent(
                new CustomEvent('logselect', {
                    detail: { log, side: undefined }
                })
            );
            await wait();
        }

        it('lists the logs of one org, the list feeding both sides', async () => {
            const element = await createSameOrg();

            expect(panel(element, 'left')).toBeNull();
            expect(panel(element, 'right')).toBeNull();
            expect(sameOrgList(element).side).toBe('both');
            expect(sameOrgList(element).sessionInformation).toEqual(
                ACME_SESSION
            );
            expect(sameOrgPicker(element).value).toBe(ACME.instanceUrl);
            expect(
                sameOrgPicker(element).options.map(({ value }) => value)
            ).toEqual(ORGS.map(({ label }) => label));
            expect(diffViewer(element).emptyMessage).toBe(
                'Tick two logs of the list to compare them.'
            );
        });

        it('compares the first two logs ticked, named after themselves', async () => {
            const element = await createSameOrg();

            await tick(element, ALPHA);
            expect(diffViewer(element).emptyMessage).toBe(
                'Now tick a second log.'
            );
            await tick(element, BETA);
            await wait();

            expect(ticked(element)).toEqual([ALPHA.id, BETA.id]);
            expect(diffViewer(element).leftLabel).toBe('Jane Roe | alpha');
            expect(diffViewer(element).rightLabel).toBe('Jane Roe | beta');
            expect(diffViewer(element).leftContent).toBe('alpha body');
            expect(diffViewer(element).rightContent).toBe('beta body');
        });

        it('replaces the last tick, the first stays to compare against', async () => {
            const element = await createSameOrg();
            await tick(element, ALPHA);
            await tick(element, BETA);

            await tick(element, GAMMA);
            expect(ticked(element)).toEqual([ALPHA.id, GAMMA.id]);

            await tick(element, DELTA);
            await wait();
            expect(ticked(element)).toEqual([ALPHA.id, DELTA.id]);
            expect(diffViewer(element).rightContent).toBe('delta body');
        });

        it('takes a ticked log off, the next tick taking its side', async () => {
            const element = await createSameOrg();
            await tick(element, ALPHA);
            await tick(element, BETA);

            await tick(element, ALPHA);
            expect(ticked(element)).toEqual([undefined, BETA.id]);
            expect(diffViewer(element).leftContent).toBeUndefined();

            await tick(element, GAMMA);
            expect(ticked(element)).toEqual([GAMMA.id, BETA.id]);
        });

        it('only reloads the side of the new tick', async () => {
            // Logs of its own, the bodies of the others are cached already.
            const [first, second, slow] = [newLog(), newLog(), newLog()];
            mockOrgs({
                bodies: { [first.id]: 'a', [second.id]: 'b', [slow.id]: 'c' },
                delays: { [slow.id]: 30 }
            });
            const element = await createCompareLogs({ scope: 'sameOrg' });
            await tick(element, first);
            await tick(element, second);
            await wait();

            await tick(element, slow);

            expect(diffViewer(element).loadingSide).toBe('right');
            expect(diffViewer(element).leftContent).toBe('a');

            await wait(50);
            expect(diffViewer(element).rightContent).toBe('c');
        });

        it('unticks both logs when its org changes', async () => {
            const element = await createSameOrg();
            await tick(element, ALPHA);
            await tick(element, BETA);

            sameOrgPicker(element).dispatchEvent(
                new CustomEvent('change', {
                    detail: { value: GLOBEX.instanceUrl }
                })
            );
            await wait();

            expect(ticked(element)).toEqual([undefined, undefined]);
            expect(sameOrgList(element).sessionInformation).toEqual(GLOBEX);
        });

        it('starts on two logs handed by the analyse list, the older on the left', async () => {
            const element = await createSameOrg({
                pair: {
                    left: { log: ALPHA, sessionInformation: ACME },
                    right: { log: BETA, sessionInformation: ACME }
                }
            });
            await wait();

            expect(ticked(element)).toEqual([ALPHA.id, BETA.id]);
            expect(sameOrgList(element).sessionInformation).toEqual(
                ACME_SESSION
            );
            expect(diffViewer(element).rightContent).toBe('beta body');

            await tick(element, GAMMA);
            expect(ticked(element)).toEqual([ALPHA.id, GAMMA.id]);
        });

        it('compares a new pair it is handed', async () => {
            const element = await createSameOrg({
                pair: {
                    left: { log: ALPHA, sessionInformation: ACME },
                    right: { log: BETA, sessionInformation: ACME }
                }
            });
            await wait();

            element.pair = {
                left: { log: ALPHA, sessionInformation: ACME },
                right: { log: DELTA, sessionInformation: ACME }
            };
            await wait();
            await wait();

            expect(diffViewer(element).rightLabel).toBe('Jane Roe | delta');
            expect(diffViewer(element).rightContent).toBe('delta body');
        });
    });
});
