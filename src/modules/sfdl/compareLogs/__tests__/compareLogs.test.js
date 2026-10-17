import { createElement } from 'lwc';
import CompareLogs from 'sfdl/compareLogs';
import { showToastEvent } from 'sfdl/utils';

jest.mock('sfdl/utils', () => ({ showToastEvent: jest.fn() }));

const ACME = {
    instanceUrl: 'https://acme.my.salesforce.com',
    authToken: 'sid-acme',
    queryWhere: ''
};
const ORGS = [
    { label: 'https://acme.my.salesforce.com', value: 'sid-acme' },
    { label: 'https://globex.my.salesforce.com', value: 'sid-globex' }
];
const LOG_ONE = {
    id: '07L1',
    name: 'John Doe | ApexTesting',
    attributes: { url: '/services/data/v51.0/tooling/sobjects/ApexLog/07L1' }
};
const LOG_TWO = {
    id: '07L2',
    name: 'Jane Roe | Api',
    attributes: { url: '/services/data/v51.0/tooling/sobjects/ApexLog/07L2' }
};
const LOG_THREE = {
    id: '07L3',
    name: 'John Doe | Batch',
    attributes: { url: '/services/data/v51.0/tooling/sobjects/ApexLog/07L3' }
};

function wait(milliseconds = 0) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function mockOrg() {
    global.fetch = jest.fn(() =>
        Promise.resolve({
            status: 200,
            json: () => Promise.resolve({ done: true, records: [] }),
            text: () => Promise.resolve('')
        })
    );
    chrome.runtime.sendMessage.mockImplementation(() =>
        Promise.resolve({ apexLogList: [LOG_ONE, LOG_TWO, LOG_THREE] })
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

const pairList = (element) =>
    element.shadowRoot.querySelector('sfdl-compare-log-list');
const diffViewer = (element) =>
    element.shadowRoot.querySelector('sfdl-diff-viewer');
const modeButton = (element, mode) =>
    element.shadowRoot.querySelector(`[data-mode="${mode}"]`);

async function selectLog(list, log, side = null) {
    list.dispatchEvent(new CustomEvent('logselect', { detail: { log, side } }));
    await wait();
}

function selection(element) {
    const list = pairList(element);
    return [list.leftLogId, list.rightLogId];
}

describe('sfdl-compare-logs', () => {
    beforeEach(() => {
        mockOrg();
    });

    describe('modes', () => {
        it('opens comparing logs of the same org', async () => {
            const element = await createCompareLogs();

            expect(
                modeButton(element, 'sameOrg').classList.contains(
                    'slds-button_brand'
                )
            ).toBe(true);
            expect(
                modeButton(element, 'twoOrgs').classList.contains(
                    'slds-button_neutral'
                )
            ).toBe(true);
            expect(pairList(element).mode).toBe('pair');
            expect(pairList(element).sessionInformation).toEqual(ACME);
        });

        it('shows the org of the header on the panel of the logs', async () => {
            const element = await createCompareLogs();

            expect(
                element.shadowRoot.querySelector('sfdl-side-panel').subtitle
            ).toBe('acme.my.salesforce.com');
        });

        it('takes the height it is given', async () => {
            const element = await createCompareLogs({ height: 640 });

            expect(
                element.shadowRoot.querySelector('.sfdl-compare-logs').style
                    .height
            ).toBe('640px');
        });

        it('asks for an org in the header when there is none', async () => {
            const element = await createCompareLogs({
                sessionInformation: undefined
            });

            expect(diffViewer(element).emptyMessage).toBe(
                'Pick an org in Organization Instances above, then two of its logs.'
            );
        });
    });

    describe('picking logs in the same org', () => {
        it('fills the left side first and then the right one', async () => {
            const element = await createCompareLogs();

            await selectLog(pairList(element), LOG_ONE);
            expect(selection(element)).toEqual(['07L1', undefined]);
            expect(diffViewer(element).emptyMessage).toBe(
                'Now pick the log for the right side.'
            );

            await selectLog(pairList(element), LOG_TWO);
            expect(selection(element)).toEqual(['07L1', '07L2']);
            expect(diffViewer(element).leftLabel).toBe(LOG_ONE.name);
            expect(diffViewer(element).rightLabel).toBe(LOG_TWO.name);
        });

        it('replaces the right log once both sides are taken', async () => {
            const element = await createCompareLogs();

            await selectLog(pairList(element), LOG_ONE);
            await selectLog(pairList(element), LOG_TWO);
            await selectLog(pairList(element), LOG_THREE);

            expect(selection(element)).toEqual(['07L1', '07L3']);
        });

        it('takes a log off when it is clicked again', async () => {
            const element = await createCompareLogs();

            await selectLog(pairList(element), LOG_ONE);
            await selectLog(pairList(element), LOG_TWO);
            await selectLog(pairList(element), LOG_ONE);

            expect(selection(element)).toEqual([undefined, '07L2']);
            expect(diffViewer(element).emptyMessage).toBe(
                'Now pick the log for the left side.'
            );

            await selectLog(pairList(element), LOG_THREE);
            expect(selection(element)).toEqual(['07L3', '07L2']);
        });

        it('sends a log to the side of its pill and takes it off with a second click', async () => {
            const element = await createCompareLogs();

            await selectLog(pairList(element), LOG_TWO, 'right');
            expect(selection(element)).toEqual([undefined, '07L2']);

            await selectLog(pairList(element), LOG_ONE, 'right');
            expect(selection(element)).toEqual([undefined, '07L1']);

            await selectLog(pairList(element), LOG_ONE, 'right');
            expect(selection(element)).toEqual([undefined, undefined]);
        });

        it('can compare a log against itself through the pills', async () => {
            const element = await createCompareLogs();

            await selectLog(pairList(element), LOG_ONE, 'left');
            await selectLog(pairList(element), LOG_ONE, 'right');

            expect(selection(element)).toEqual(['07L1', '07L1']);

            await selectLog(pairList(element), LOG_ONE);
            expect(selection(element)).toEqual([undefined, undefined]);
        });

        it('forgets the logs of the previous org when the header org changes', async () => {
            const element = await createCompareLogs();
            await selectLog(pairList(element), LOG_ONE);

            element.sessionInformation = {
                instanceUrl: 'https://globex.my.salesforce.com',
                authToken: 'sid-globex'
            };
            await wait();

            expect(selection(element)).toEqual([undefined, undefined]);
        });

        it('keeps the logs when the header filter runs again on the same org', async () => {
            const element = await createCompareLogs();
            await selectLog(pairList(element), LOG_ONE);

            element.sessionInformation = {
                ...ACME,
                queryWhere: 'WHERE Id != null'
            };
            await wait();

            expect(selection(element)).toEqual(['07L1', undefined]);
        });

        it('starts over when the mode changes', async () => {
            const element = await createCompareLogs();
            await selectLog(pairList(element), LOG_ONE);

            modeButton(element, 'twoOrgs').click();
            await wait();
            modeButton(element, 'sameOrg').click();
            await wait();

            expect(selection(element)).toEqual([undefined, undefined]);
        });
    });

    describe('comparing the bodies', () => {
        // The bodies are cached for the whole session, every test gets logs
        // of its own.
        let logCount = 0;
        function newLog() {
            logCount++;
            const id = '07LB' + logCount;
            return {
                id,
                name: 'log ' + id,
                attributes: {
                    url: '/services/data/v51.0/tooling/sobjects/ApexLog/' + id
                }
            };
        }

        function mockBodies(bodies, { failing = [], delays = {} } = {}) {
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
                              Promise.resolve([
                                  { message: 'The log was deleted' }
                              ])
                      }
                    : {
                          status: 200,
                          text: () => Promise.resolve(bodies[logId])
                      };
                return new Promise((resolve) =>
                    setTimeout(() => resolve(response), delays[logId] || 0)
                );
            });
        }

        const bodyDownloads = () =>
            fetch.mock.calls.filter(([url]) => url.endsWith('/Body'));

        it('compares both logs once both are picked', async () => {
            const [one, two] = [newLog(), newLog()];
            mockBodies({
                [one.id]: '10:00:00.1 (1)|USER_DEBUG|[1]|DEBUG|same',
                [two.id]: '11:30:00.9 (999)|USER_DEBUG|[1]|DEBUG|same'
            });
            const element = await createCompareLogs();

            await selectLog(pairList(element), one);
            expect(diffViewer(element).leftContent).toBeUndefined();

            await selectLog(pairList(element), two);
            await wait();

            expect(diffViewer(element).leftContent).toBe(
                'USER_DEBUG|[1]|DEBUG|same'
            );
            expect(diffViewer(element).rightContent).toBe(
                'USER_DEBUG|[1]|DEBUG|same'
            );
            expect(diffViewer(element).language).toBe('apexlog');
        });

        it('starts downloading the first log before the second one is picked', async () => {
            const [one] = [newLog()];
            mockBodies({ [one.id]: 'body' });
            const element = await createCompareLogs();

            await selectLog(pairList(element), one);

            expect(bodyDownloads()).toHaveLength(1);
        });

        it('shows the spinner while the bodies download', async () => {
            const [one, two] = [newLog(), newLog()];
            mockBodies(
                { [one.id]: 'a', [two.id]: 'b' },
                { delays: { [two.id]: 30 } }
            );
            const element = await createCompareLogs();

            await selectLog(pairList(element), one);
            await selectLog(pairList(element), two);
            expect(diffViewer(element).loading).toBe(true);

            await wait(50);
            expect(diffViewer(element).loading).toBe(false);
        });

        it('downloads a log only once', async () => {
            const [one, two, three] = [newLog(), newLog(), newLog()];
            mockBodies({ [one.id]: 'a', [two.id]: 'b', [three.id]: 'c' });
            const element = await createCompareLogs();

            await selectLog(pairList(element), one);
            await selectLog(pairList(element), two);
            await selectLog(pairList(element), three);
            await selectLog(pairList(element), two, 'right');
            await wait();

            expect(bodyDownloads()).toHaveLength(3);
            expect(diffViewer(element).rightContent).toBe('b');
        });

        it('filters both logs again when an option changes, without downloading them', async () => {
            const [one, two] = [newLog(), newLog()];
            const body = [
                '10:00:00.1 (1)|HEAP_ALLOCATE|[5]|Bytes:3',
                '10:00:00.2 (2)|USER_DEBUG|[6]|DEBUG|hello'
            ].join('\n');
            mockBodies({ [one.id]: body, [two.id]: body });
            const element = await createCompareLogs();
            await selectLog(pairList(element), one);
            await selectLog(pairList(element), two);
            await wait();

            expect(diffViewer(element).leftContent).toBe(
                'USER_DEBUG|[6]|DEBUG|hello'
            );

            const menu = element.shadowRoot.querySelector(
                'sfdl-log-manipulation-menu'
            );
            menu.shadowRoot.querySelector('sfdl-checkbox').dispatchEvent(
                new CustomEvent('checkboxselection', {
                    detail: {
                        function2Execute:
                            'removeHeapAllocateAndStatementExecute',
                        checked: false
                    }
                })
            );
            menu.shadowRoot.querySelector('sfdl-checkbox').dispatchEvent(
                new CustomEvent('checkboxselection', {
                    detail: {
                        function2Execute: 'ignoreTimestamps',
                        checked: false
                    }
                })
            );
            await wait();

            expect(diffViewer(element).leftContent).toBe(body);
            expect(bodyDownloads()).toHaveLength(2);
        });

        it('takes a log off and says why when it cannot be downloaded', async () => {
            const [one, two] = [newLog(), newLog()];
            mockBodies({ [one.id]: 'a', [two.id]: 'b' }, { failing: [two.id] });
            const element = await createCompareLogs();

            await selectLog(pairList(element), one);
            await selectLog(pairList(element), two);
            await wait();

            expect(showToastEvent).toHaveBeenCalledWith(
                'error',
                'The log could not be downloaded',
                'The log was deleted'
            );
            expect(selection(element)).toEqual([one.id, undefined]);
            expect(diffViewer(element).loading).toBe(false);
        });

        it('shows the latest pick when an earlier download comes back late', async () => {
            const [one, slow, fast] = [newLog(), newLog(), newLog()];
            mockBodies(
                { [one.id]: 'a', [slow.id]: 'slow', [fast.id]: 'fast' },
                { delays: { [slow.id]: 40 } }
            );
            const element = await createCompareLogs();

            await selectLog(pairList(element), one);
            await selectLog(pairList(element), slow);
            await selectLog(pairList(element), fast);
            await wait(60);

            expect(diffViewer(element).rightContent).toBe('fast');
        });

        it('empties the diff when a side is taken off', async () => {
            const [one, two] = [newLog(), newLog()];
            mockBodies({ [one.id]: 'a', [two.id]: 'b' });
            const element = await createCompareLogs();
            await selectLog(pairList(element), one);
            await selectLog(pairList(element), two);
            await wait();

            await selectLog(pairList(element), two);

            expect(diffViewer(element).leftContent).toBeUndefined();
            expect(diffViewer(element).rightContent).toBeUndefined();
        });
    });

    describe('two orgs', () => {
        const GLOBEX = {
            instanceUrl: 'https://globex.my.salesforce.com',
            authToken: 'sid-globex'
        };
        const sideList = (element, side) =>
            element.shadowRoot.querySelector(
                `.sfdl-compare-logs__${side}-panel sfdl-compare-log-list`
            );
        const orgPicker = (element, side) =>
            element.shadowRoot.querySelector(
                `.sfdl-compare-logs__${side}-panel sfdl-combobox`
            );
        const panel = (element, side) =>
            element.shadowRoot.querySelector(
                `.sfdl-compare-logs__${side}-panel`
            );

        async function createTwoOrgs(properties) {
            const element = await createCompareLogs(properties);
            modeButton(element, 'twoOrgs').click();
            await wait();
            return element;
        }

        async function pickOrg(element, side, instanceUrl) {
            orgPicker(element, side).dispatchEvent(
                new CustomEvent('change', { detail: { value: instanceUrl } })
            );
            await wait();
        }

        it('lays out a log list for each side around the diff', async () => {
            const element = await createTwoOrgs();
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
            expect(sideList(element, 'left').mode).toBe('single');
            expect(sideList(element, 'right').side).toBe('right');
            expect(
                element.shadowRoot.querySelector(
                    '.sfdl-compare-logs__pair-panel'
                )
            ).toBeNull();
        });

        it('offers every org session on both pickers', async () => {
            const element = await createTwoOrgs();

            expect(orgPicker(element, 'right').options).toEqual([
                {
                    label: 'acme.my.salesforce.com',
                    value: 'https://acme.my.salesforce.com'
                },
                {
                    label: 'globex.my.salesforce.com',
                    value: 'https://globex.my.salesforce.com'
                }
            ]);
        });

        it('starts the left side on the org of the header, without its filter', async () => {
            const element = await createTwoOrgs({
                sessionInformation: { ...ACME, queryWhere: 'WHERE Id != null' }
            });

            expect(orgPicker(element, 'left').value).toBe(ACME.instanceUrl);
            expect(sideList(element, 'left').sessionInformation).toEqual({
                instanceUrl: ACME.instanceUrl,
                authToken: ACME.authToken
            });
            expect(
                sideList(element, 'right').sessionInformation
            ).toBeUndefined();
            expect(panel(element, 'right').subtitle).toBe('No org picked yet');
        });

        it('takes the header org for the left side when it comes later', async () => {
            const element = await createTwoOrgs({
                sessionInformation: undefined
            });

            element.sessionInformation = ACME;
            await wait();

            expect(orgPicker(element, 'left').value).toBe(ACME.instanceUrl);
        });

        it('lists the logs of the org picked on each side', async () => {
            const element = await createTwoOrgs();

            await pickOrg(element, 'right', GLOBEX.instanceUrl);

            expect(sideList(element, 'right').sessionInformation).toEqual(
                GLOBEX
            );
            expect(panel(element, 'right').subtitle).toBe(
                'globex.my.salesforce.com'
            );
        });

        it('compares a log of each org and names the org of each side', async () => {
            // Logs no other test downloaded, the bodies are cached per session.
            const leftLog = {
                ...LOG_ONE,
                id: '07LTWO1',
                attributes: {
                    url: '/services/data/v51.0/tooling/sobjects/ApexLog/07LTWO1'
                }
            };
            const rightLog = {
                ...LOG_TWO,
                id: '07LTWO2',
                attributes: {
                    url: '/services/data/v51.0/tooling/sobjects/ApexLog/07LTWO2'
                }
            };
            const element = await createTwoOrgs();
            await pickOrg(element, 'right', GLOBEX.instanceUrl);

            await selectLog(sideList(element, 'left'), leftLog, 'left');
            await selectLog(sideList(element, 'right'), rightLog, 'right');

            expect(sideList(element, 'left').leftLogId).toBe('07LTWO1');
            expect(sideList(element, 'right').rightLogId).toBe('07LTWO2');
            expect(diffViewer(element).leftLabel).toBe(
                'acme \u00b7 ' + LOG_ONE.name
            );
            expect(diffViewer(element).rightLabel).toBe(
                'globex \u00b7 ' + LOG_TWO.name
            );
            expect(
                fetch.mock.calls
                    .map(([url]) => url)
                    .filter((url) => url.endsWith('/Body'))
            ).toEqual([
                'https://acme.my.salesforce.com/services/data/v51.0/tooling/sobjects/ApexLog/07LTWO1/Body',
                'https://globex.my.salesforce.com/services/data/v51.0/tooling/sobjects/ApexLog/07LTWO2/Body'
            ]);
        });

        it('takes the log off a side when its org changes', async () => {
            const element = await createTwoOrgs();
            await selectLog(sideList(element, 'left'), LOG_ONE, 'left');

            await pickOrg(element, 'left', GLOBEX.instanceUrl);

            expect(sideList(element, 'left').leftLogId).toBeUndefined();
        });

        it('keeps its orgs when the header org changes', async () => {
            const element = await createTwoOrgs();
            await pickOrg(element, 'right', GLOBEX.instanceUrl);
            await selectLog(sideList(element, 'left'), LOG_ONE, 'left');

            element.sessionInformation = GLOBEX;
            await wait();

            expect(orgPicker(element, 'left').value).toBe(ACME.instanceUrl);
            expect(sideList(element, 'left').leftLogId).toBe('07L1');
        });
    });

    describe('swapping and folding', () => {
        const GLOBEX = {
            instanceUrl: 'https://globex.my.salesforce.com',
            authToken: 'sid-globex'
        };
        const swapButton = (element) =>
            element.shadowRoot.querySelector('.sfdl-compare-logs__swap');
        const sideList = (element, side) =>
            element.shadowRoot.querySelector(
                `.sfdl-compare-logs__${side}-panel sfdl-compare-log-list`
            );

        it('cannot swap before a log is picked', async () => {
            const element = await createCompareLogs();

            expect(swapButton(element).disabled).toBe(true);
        });

        it('swaps the logs of both sides', async () => {
            const element = await createCompareLogs();
            await selectLog(pairList(element), LOG_ONE);
            await selectLog(pairList(element), LOG_TWO);

            swapButton(element).click();
            await wait();

            expect(selection(element)).toEqual(['07L2', '07L1']);
            expect(diffViewer(element).leftLabel).toBe(LOG_TWO.name);
        });

        it('swaps a lonely log to the other side', async () => {
            const element = await createCompareLogs();
            await selectLog(pairList(element), LOG_ONE);

            swapButton(element).click();
            await wait();

            expect(selection(element)).toEqual([undefined, '07L1']);
        });

        it('swaps the orgs along with the logs between two orgs', async () => {
            const element = await createCompareLogs();
            modeButton(element, 'twoOrgs').click();
            await wait();
            element.shadowRoot
                .querySelector('.sfdl-compare-logs__right-panel sfdl-combobox')
                .dispatchEvent(
                    new CustomEvent('change', {
                        detail: { value: GLOBEX.instanceUrl }
                    })
                );
            await wait();
            await selectLog(sideList(element, 'left'), LOG_ONE, 'left');

            swapButton(element).click();
            await wait();

            expect(sideList(element, 'left').sessionInformation).toEqual(
                GLOBEX
            );
            expect(
                sideList(element, 'right').sessionInformation.instanceUrl
            ).toBe(ACME.instanceUrl);
            expect(sideList(element, 'right').rightLogId).toBe('07L1');
            expect(diffViewer(element).rightLabel).toBe(
                'acme \u00b7 ' + LOG_ONE.name
            );
        });

        it('folds the log list and gives the room to the diff', async () => {
            const element = await createCompareLogs();
            const logsPanel =
                element.shadowRoot.querySelector('sfdl-side-panel');

            logsPanel.shadowRoot
                .querySelector('.sfdl-side-panel__collapse')
                .click();
            await wait();

            expect(
                logsPanel.shadowRoot
                    .querySelector('.sfdl-side-panel__content')
                    .classList.contains('slds-hide')
            ).toBe(true);
            expect(pairList(element)).not.toBeNull();
        });

        it('folds either side of two orgs on its own', async () => {
            const element = await createCompareLogs();
            modeButton(element, 'twoOrgs').click();
            await wait();
            const panel = (side) =>
                element.shadowRoot.querySelector(
                    `.sfdl-compare-logs__${side}-panel`
                );

            panel('right')
                .shadowRoot.querySelector('.sfdl-side-panel__collapse')
                .click();
            await wait();

            expect(
                panel('right')
                    .shadowRoot.querySelector('.sfdl-side-panel__content')
                    .classList.contains('slds-hide')
            ).toBe(true);
            expect(
                panel('left')
                    .shadowRoot.querySelector('.sfdl-side-panel__content')
                    .classList.contains('slds-hide')
            ).toBe(false);
        });
    });
});
