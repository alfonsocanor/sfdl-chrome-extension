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
const swapButton = (element) =>
    element.shadowRoot.querySelector('.sfdl-compare-logs__swap');
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
            expect(panel(element, 'right').subtitle).toBe('No org picked yet');
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
            expect(panel(element, 'right').subtitle).toBe(
                'globex.my.salesforce.com'
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

            const checkbox = element.shadowRoot
                .querySelector('sfdl-log-manipulation-menu')
                .shadowRoot.querySelector('sfdl-checkbox');
            [
                'removeHeapAllocateAndStatementExecute',
                'ignoreTimestamps'
            ].forEach((function2Execute) =>
                checkbox.dispatchEvent(
                    new CustomEvent('checkboxselection', {
                        detail: { function2Execute, checked: false }
                    })
                )
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
            element.shadowRoot
                .querySelector('sfdl-log-manipulation-menu')
                .shadowRoot.querySelector('sfdl-checkbox')
                .dispatchEvent(
                    new CustomEvent('checkboxselection', {
                        detail: {
                            function2Execute: 'ignoreTimestamps',
                            checked: false
                        }
                    })
                );
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

    describe('swapping and folding', () => {
        it('cannot swap before an org or a log is on either side', async () => {
            const element = await createCompareLogs({
                sessionInformation: undefined
            });

            expect(swapButton(element).disabled).toBe(true);
        });

        it('swaps the orgs along with their logs', async () => {
            const log = newLog('Jane Roe | Api');
            const element = await ready();
            await selectLog(element, 'left', log);

            swapButton(element).click();
            await wait();

            expect(sideList(element, 'left').sessionInformation).toEqual(
                GLOBEX
            );
            expect(sideList(element, 'right').sessionInformation).toEqual(
                ACME_SESSION
            );
            expect(sideList(element, 'right').rightLogId).toBe(log.id);
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

    describe('a pair of logs of one org', () => {
        async function comparePair(left, right) {
            return createCompareLogs({
                pair: {
                    left: { log: left, sessionInformation: ACME },
                    right: { log: right, sessionInformation: ACME }
                }
            });
        }

        it('shows the two logs alone, named after themselves', async () => {
            const [left, right] = [
                newLog('Jane Roe | older'),
                newLog('Jane Roe | newer')
            ];
            mockOrgs({
                bodies: { [left.id]: 'older body', [right.id]: 'newer body' }
            });

            const element = await comparePair(left, right);
            await wait();

            expect(panel(element, 'left')).toBeNull();
            expect(panel(element, 'right')).toBeNull();
            expect(diffViewer(element).leftLabel).toBe('Jane Roe | older');
            expect(diffViewer(element).rightLabel).toBe('Jane Roe | newer');
            expect(diffViewer(element).leftContent).toBe('older body');
            expect(diffViewer(element).rightContent).toBe('newer body');
            expect(bodyDownloads()).toEqual([
                'https://acme.my.salesforce.com' +
                    left.attributes.url +
                    '/Body',
                'https://acme.my.salesforce.com' +
                    right.attributes.url +
                    '/Body'
            ]);
        });

        it('swaps the two logs', async () => {
            const [left, right] = [newLog('older'), newLog('newer')];
            mockOrgs({ bodies: { [left.id]: 'a', [right.id]: 'b' } });
            const element = await comparePair(left, right);
            await wait();

            element.shadowRoot
                .querySelector('.sfdl-compare-logs__pair-swap')
                .click();
            await wait();

            expect(diffViewer(element).leftLabel).toBe('newer');
            expect(diffViewer(element).leftContent).toBe('b');
        });

        it('asks to be closed', async () => {
            const [left, right] = [newLog(), newLog()];
            mockOrgs({ bodies: { [left.id]: 'a', [right.id]: 'b' } });
            const element = await comparePair(left, right);
            const handleClose = jest.fn();
            element.addEventListener('close', handleClose);
            await wait();

            element.shadowRoot
                .querySelector('.sfdl-compare-logs__close')
                .click();

            expect(handleClose).toHaveBeenCalled();
        });

        it('compares a new pair it is handed', async () => {
            const [left, right, other] = [newLog(), newLog(), newLog('other')];
            mockOrgs({
                bodies: { [left.id]: 'a', [right.id]: 'b', [other.id]: 'c' }
            });
            const element = await comparePair(left, right);
            await wait();

            element.pair = {
                left: { log: left, sessionInformation: ACME },
                right: { log: other, sessionInformation: ACME }
            };
            await wait();
            await wait();

            expect(diffViewer(element).rightLabel).toBe('other');
            expect(diffViewer(element).rightContent).toBe('c');
        });
    });
});
