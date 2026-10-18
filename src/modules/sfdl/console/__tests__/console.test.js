import { createElement } from 'lwc';
import Console from 'sfdl/console';
import { css } from '../consoleCss';

jest.mock('sfdl/utils', () => ({
    showToastEvent: jest.fn(),
    setKeyValueLocalStorage: jest.fn(),
    getValueLocalStorage: jest.fn(() => Promise.resolve(false)),
    clearLocalStorage: jest.fn()
}));

const COOKIES = [
    { domain: 'acme.my.salesforce.com', value: 'sid-acme' },
    { domain: 'expired.my.salesforce.com', value: 'sid-expired' }
];

function wait(milliseconds = 0) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function mockOrgSessions(
    cookies = COOKIES,
    validDomains = ['acme.my.salesforce.com']
) {
    // The cookie lookup is resolved on a macrotask, the way the real chrome api
    // behaves, so the picklist is rendered by the time the console fills it in.
    chrome.cookies.getAll.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(cookies), 0))
    );
    global.fetch = jest.fn((url) =>
        Promise.resolve({
            status: validDomains.some((domain) => url.includes(domain))
                ? 200
                : 401,
            statusText: 'Unauthorized',
            json: () => Promise.resolve({ records: [] })
        })
    );
}

async function createConsole() {
    const element = createElement('sfdl-console', { is: Console });
    document.body.appendChild(element);
    await wait();
    await wait();
    return element;
}

const picklist = (element) => element.shadowRoot.querySelector('sfdl-picklist');

function spyOnPicklistValues() {
    const element = createElement('sfdl-console', { is: Console });
    document.body.appendChild(element);
    return {
        element,
        setPicklistValues: jest.spyOn(picklist(element), 'setPicklistValues')
    };
}
const logList = (element) => element.shadowRoot.querySelector('sfdl-log-list');
const logDetails = (element) =>
    element.shadowRoot.querySelector('sfdl-log-details');
const tab = (element, tabName) =>
    element.shadowRoot.querySelector(`a[data-tabname="${tabName}"]`);

function click(node) {
    node.dispatchEvent(
        new CustomEvent('click', { bubbles: true, composed: true })
    );
}

async function selectOrg(element) {
    picklist(element).dispatchEvent(
        new CustomEvent('sessioninformation', {
            detail: {
                sessionInformation: {
                    instanceUrl: 'https://acme.my.salesforce.com',
                    authToken: 'sid-acme',
                    queryWhere: ''
                }
            }
        })
    );
    await wait(150);
}

describe('sfdl-console', () => {
    beforeEach(() => {
        mockOrgSessions();
    });

    describe('layout', () => {
        it('renders the org picker, the two tabs and the footer', async () => {
            const element = await createConsole();

            expect(picklist(element)).not.toBeNull();
            expect(
                [
                    ...element.shadowRoot.querySelectorAll(
                        '.slds-tabs_scoped__link'
                    )
                ].map((link) => link.dataset.tabname)
            ).toEqual(['debugLogs', 'compareMetadata']);
            expect(
                element.shadowRoot.querySelector('sfdl-footer')
            ).not.toBeNull();
        });

        it('waits for an org before rendering the log list', async () => {
            const element = await createConsole();

            expect(logList(element)).toBeNull();
            expect(logDetails(element)).not.toBeNull();
        });
    });

    describe('org sessions', () => {
        it('offers only the orgs with a session that is still valid', async () => {
            const { setPicklistValues } = spyOnPicklistValues();

            await wait();
            await wait();

            expect(setPicklistValues).toHaveBeenCalledWith([
                { label: 'https://acme.my.salesforce.com', value: 'sid-acme' }
            ]);
        });

        it('offers an empty list when the browser holds no salesforce cookie', async () => {
            mockOrgSessions([]);
            const { setPicklistValues } = spyOnPicklistValues();

            await wait();
            await wait();

            expect(setPicklistValues).toHaveBeenCalledWith([]);
        });

        it('waits for every session before publishing the list', async () => {
            const cookies = [
                { domain: 'slow.my.salesforce.com', value: 'sid-slow' },
                { domain: 'fast.my.salesforce.com', value: 'sid-fast' }
            ];
            chrome.cookies.getAll.mockImplementation(
                () =>
                    new Promise((resolve) =>
                        setTimeout(() => resolve(cookies), 0)
                    )
            );
            // The last cookie answers first, which used to publish a list that
            // was still missing the slow org.
            global.fetch = jest.fn(
                (url) =>
                    new Promise((resolve) =>
                        setTimeout(
                            () => resolve({ status: 200 }),
                            url.includes('slow') ? 30 : 0
                        )
                    )
            );
            const { setPicklistValues } = spyOnPicklistValues();

            await wait(50);

            expect(setPicklistValues).toHaveBeenCalledTimes(1);
            expect(setPicklistValues).toHaveBeenCalledWith([
                { label: 'https://slow.my.salesforce.com', value: 'sid-slow' },
                { label: 'https://fast.my.salesforce.com', value: 'sid-fast' }
            ]);
        });

        it('offers each domain once even when it holds several sessions', async () => {
            mockOrgSessions(
                [
                    { domain: 'acme.my.salesforce.com', value: 'sid-old' },
                    { domain: 'acme.my.salesforce.com', value: 'sid-new' }
                ],
                ['acme.my.salesforce.com']
            );
            const { setPicklistValues } = spyOnPicklistValues();

            await wait();
            await wait();

            expect(setPicklistValues).toHaveBeenCalledWith([
                { label: 'https://acme.my.salesforce.com', value: 'sid-old' }
            ]);
        });

        it('renders the log list for the org that was picked', async () => {
            const element = await createConsole();

            await selectOrg(element);

            expect(logList(element)).not.toBeNull();
            expect(logList(element).sessionInformation.instanceUrl).toBe(
                'https://acme.my.salesforce.com'
            );
        });
    });

    describe('tab navigation', () => {
        const tabItem = (element, tabHtmlClass) =>
            element.shadowRoot.querySelector('.' + tabHtmlClass);
        const tabContent = (element, contentHtmlClass) =>
            element.shadowRoot.querySelector('.' + contentHtmlClass);
        const modeButton = (element, mode) =>
            element.shadowRoot.querySelector(`[data-mode="${mode}"]`);
        const isShown = (element, contentHtmlClass) =>
            !tabContent(element, contentHtmlClass).classList.contains(
                'slds-hide'
            );

        it('opens on the debug logs tab, analysing', async () => {
            const element = await createConsole();

            expect(
                tabItem(element, 'liElementDebugLogs').classList.contains(
                    'slds-is-active'
                )
            ).toBe(true);
            expect(isShown(element, 'sfdl-debug-logs')).toBe(true);
            expect(isShown(element, 'sfdl-debug-logs__analyse')).toBe(true);
            expect(modeButton(element, 'analyse').classList).toContain(
                'slds-button_brand'
            );
            expect(
                element.shadowRoot.querySelector('.sfdl-debug-logs__hint')
                    .textContent
            ).toBe(
                'Pick a log to read it, or tick two logs and compare them side by side.'
            );
        });

        it('builds the comparisons only once they are opened', async () => {
            const element = await createConsole();

            expect(
                element.shadowRoot.querySelector('sfdl-compare-logs')
            ).toBeNull();
            expect(
                element.shadowRoot.querySelector('sfdl-compare-orgs')
            ).toBeNull();
        });

        it('compares two orgs in the same tab and keeps the analysis', async () => {
            const element = await createConsole();

            click(modeButton(element, 'compare'));
            await wait();

            expect(isShown(element, 'sfdl-debug-logs__analyse')).toBe(false);
            expect(isShown(element, 'sfdl-debug-logs__compare')).toBe(true);
            expect(modeButton(element, 'compare').classList).toContain(
                'slds-button_brand'
            );
            expect(
                modeButton(element, 'compare').getAttribute('aria-pressed')
            ).toBe('true');

            click(modeButton(element, 'analyse'));
            await wait();

            expect(isShown(element, 'sfdl-debug-logs__analyse')).toBe(true);
            expect(isShown(element, 'sfdl-debug-logs__compare')).toBe(false);
            expect(
                element.shadowRoot.querySelector('sfdl-compare-logs')
            ).not.toBeNull();
            expect(logDetails(element)).not.toBeNull();
        });

        it('opens the compare metadata tab and hides the debug logs one', async () => {
            const element = await createConsole();

            click(tab(element, 'compareMetadata'));
            await wait();

            expect(
                tabItem(element, 'liElementCompareMetadata').classList.contains(
                    'slds-is-active'
                )
            ).toBe(true);
            expect(
                tabItem(element, 'liElementDebugLogs').classList.contains(
                    'slds-is-active'
                )
            ).toBe(false);
            expect(isShown(element, 'sfdl-compare-metadata')).toBe(true);
            expect(isShown(element, 'sfdl-debug-logs')).toBe(false);
        });

        it('hands the org sessions and the selected org to the comparisons', async () => {
            const element = await createConsole();
            await selectOrg(element);

            click(modeButton(element, 'compare'));
            click(tab(element, 'compareMetadata'));
            await wait();

            ['sfdl-compare-logs', 'sfdl-compare-orgs'].forEach((tagName) => {
                const compareTab = element.shadowRoot.querySelector(tagName);
                expect(compareTab.orgs).toEqual([
                    {
                        label: 'https://acme.my.salesforce.com',
                        value: 'sid-acme'
                    }
                ]);
                expect(compareTab.sessionInformation.instanceUrl).toBe(
                    'https://acme.my.salesforce.com'
                );
            });
        });
    });

    describe('wiring between the panels', () => {
        it('forwards the manipulation options to the log list', async () => {
            const element = await createConsole();
            await selectOrg(element);
            const manipulationOptions = [
                {
                    label: 'HEAP',
                    name: 'removeHeapAllocateAndStatementExecute',
                    checked: false
                }
            ];
            const handleManipulationOptions = jest.spyOn(
                logList(element),
                'handleManipulationOptionsForDownloading'
            );

            logDetails(element).dispatchEvent(
                new CustomEvent('manipulationoptions', {
                    detail: { manipulationOptions }
                })
            );

            expect(handleManipulationOptions).toHaveBeenCalledWith(
                manipulationOptions
            );
        });

        it('forwards the selected log to the log details panel', async () => {
            const element = await createConsole();
            await selectOrg(element);
            const processLogs = jest
                .spyOn(logDetails(element), 'processLogsFromLogList')
                .mockImplementation(() => {});

            logList(element).dispatchEvent(
                new CustomEvent('logdetails', {
                    detail: {
                        logName: 'a log',
                        logDetails: { response: 'body' }
                    }
                })
            );

            expect(processLogs).toHaveBeenCalledWith(
                { response: 'body' },
                'a log'
            );
        });

        it('collapses and expands the log list panel', async () => {
            const element = await createConsole();
            const panel = element.shadowRoot.querySelector(
                '.sfdl-console-log-list-section'
            );

            logDetails(element).dispatchEvent(
                new CustomEvent('displayloglistsection', {
                    detail: { classAction: 'remove' }
                })
            );
            await wait(150);
            expect(panel.classList.contains('slds-is-open')).toBe(false);

            logDetails(element).dispatchEvent(
                new CustomEvent('displayloglistsection', {
                    detail: { classAction: 'add' }
                })
            );
            await wait(150);
            expect(panel.classList.contains('slds-is-open')).toBe(true);
        });
    });

    describe('the log list panel', () => {
        const panel = (element) =>
            element.shadowRoot.querySelector('.sfdl-console-log-list-section');

        async function toggleLogList(element, classAction) {
            logDetails(element).dispatchEvent(
                new CustomEvent('displayloglistsection', {
                    detail: { classAction }
                })
            );
            await wait(150);
        }

        it('grows from nothing only while its toggle opens it', async () => {
            const element = await createConsole();
            await toggleLogList(element, 'remove');

            await toggleLogList(element, 'add');

            expect(panel(element).classList).toContain('log-list-is-opening');
            expect(panel(element).classList).not.toContain(
                'log-list-is-closed'
            );

            await wait(750);

            expect(panel(element).classList).not.toContain(
                'log-list-is-opening'
            );
        });

        it('does not open again when its tab is shown again', async () => {
            const element = await createConsole();

            click(tab(element, 'compareMetadata'));
            await wait();
            click(tab(element, 'debugLogs'));
            await wait();

            expect(panel(element).classList).not.toContain(
                'log-list-is-opening'
            );
        });

        it('keeps its starting style to its own opening', () => {
            // A starting style applies whenever an element starts being
            // rendered, showing the tab again included.
            expect(css).not.toMatch(/^\s*\.slds-is-open\s*\{/m);
            expect(css).toMatch(
                /@starting-style\s*\{\s*\.sfdl-console-log-list-section\.log-list-is-opening\s*\{/
            );
            expect(css.match(/@starting-style/g)).toHaveLength(1);
        });
    });

    describe('comparing two logs of the org', () => {
        const LEFT_LOG = {
            id: '07L2',
            name: 'older',
            attributes: { url: '/two' }
        };
        const RIGHT_LOG = {
            id: '07L1',
            name: 'newer',
            attributes: { url: '/one' }
        };
        const pairComparison = (element) =>
            element.shadowRoot.querySelector('.sfdl-debug-logs__pair');

        async function compareTwoLogs(element) {
            logList(element).dispatchEvent(
                new CustomEvent('comparelogs', {
                    detail: { logs: [LEFT_LOG, RIGHT_LOG] }
                })
            );
            await wait();
        }

        it('compares them in place of the editor', async () => {
            const element = await createConsole();
            await selectOrg(element);

            await compareTwoLogs(element);

            expect(pairComparison(element).pair).toEqual({
                left: {
                    log: LEFT_LOG,
                    sessionInformation: expect.objectContaining({
                        instanceUrl: 'https://acme.my.salesforce.com'
                    })
                },
                right: {
                    log: RIGHT_LOG,
                    sessionInformation: expect.objectContaining({
                        instanceUrl: 'https://acme.my.salesforce.com'
                    })
                }
            });
            expect(logDetails(element).classList.contains('slds-hide')).toBe(
                true
            );
        });

        it('goes back to the log when the comparison is closed', async () => {
            const element = await createConsole();
            await selectOrg(element);
            await compareTwoLogs(element);

            pairComparison(element).dispatchEvent(new CustomEvent('close'));
            await wait();

            expect(pairComparison(element)).toBeNull();
            expect(logDetails(element).classList.contains('slds-hide')).toBe(
                false
            );
        });

        it('goes back to reading when a log is opened', async () => {
            const element = await createConsole();
            await selectOrg(element);
            await compareTwoLogs(element);
            jest.spyOn(
                logDetails(element),
                'processLogsFromLogList'
            ).mockImplementation(() => {});

            logList(element).dispatchEvent(
                new CustomEvent('logdetails', {
                    detail: {
                        logName: 'a log',
                        logDetails: { response: 'body' }
                    }
                })
            );
            await wait();

            expect(pairComparison(element)).toBeNull();
        });

        it('closes when another org is picked in the header', async () => {
            const element = await createConsole();
            await selectOrg(element);
            await compareTwoLogs(element);

            await selectOrg(element);

            expect(pairComparison(element)).toBeNull();
        });
    });
});
