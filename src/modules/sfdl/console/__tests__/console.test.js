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
                picklist(element).closest('.sfdl-console-log-list-section')
            ).not.toBeNull();
            expect(
                element.shadowRoot.querySelector('.sfdl-console-header')
            ).toBeNull();
            expect(
                [
                    ...element.shadowRoot.querySelectorAll(
                        '.slds-tabs_scoped__link'
                    )
                ].map((link) => link.dataset.tabname)
            ).toEqual(['debugLogs', 'compareMetadata', 'monitoring']);
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

            // Well past the slow answer, a busy run included.
            await wait(150);

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

        it('tells the log details whether an org is picked, so they ask for one until then', async () => {
            const element = await createConsole();

            expect(picklist(element).placeholder).toBe('Pick the org');
            expect(logDetails(element).orgPicked).toBe(false);

            await selectOrg(element);

            expect(logDetails(element).orgPicked).toBe(true);
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
                'Pick an org in the log list, then a log to read it, or tick two logs and compare them side by side.'
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

        it('compares logs of the same org or of two orgs, and keeps the analysis', async () => {
            const element = await createConsole();
            const scopeButton = (scope) =>
                element.shadowRoot.querySelector(`[data-scope="${scope}"]`);

            expect(scopeButton('sameOrg')).toBeNull();

            click(modeButton(element, 'compare'));
            await wait();

            expect(isShown(element, 'sfdl-debug-logs__analyse')).toBe(false);
            expect(isShown(element, 'sfdl-debug-logs__same-org')).toBe(true);
            expect(
                element.shadowRoot.querySelector('.sfdl-debug-logs__two-orgs')
            ).toBeNull();
            expect(modeButton(element, 'compare').textContent).toBe(
                'Compare logs'
            );
            expect(
                modeButton(element, 'compare').getAttribute('aria-pressed')
            ).toBe('true');
            expect(scopeButton('sameOrg').getAttribute('aria-pressed')).toBe(
                'true'
            );

            click(scopeButton('twoOrgs'));
            await wait();

            expect(
                tabContent(element, 'sfdl-debug-logs__two-orgs').classList
            ).toContain('sfdl-debug-logs__two-orgs_entering');
            expect(isShown(element, 'sfdl-debug-logs__same-org')).toBe(false);
            expect(isShown(element, 'sfdl-debug-logs__two-orgs')).toBe(true);
            expect(
                [
                    ...element.shadowRoot.querySelectorAll('sfdl-compare-logs')
                ].map((compareLogs) => compareLogs.scope)
            ).toEqual(['sameOrg', 'twoOrgs']);

            click(modeButton(element, 'analyse'));
            await wait();

            expect(isShown(element, 'sfdl-debug-logs__analyse')).toBe(true);
            expect(isShown(element, 'sfdl-debug-logs__two-orgs')).toBe(false);
            expect(scopeButton('twoOrgs')).toBeNull();
            expect(logDetails(element)).not.toBeNull();
        });

        it('marks the view coming on screen for a moment, so its org picker grows or shrinks to its width', async () => {
            const element = await createConsole();
            const analyse = () => tabContent(element, 'sfdl-debug-logs__analyse').classList;
            const sameOrg = () => tabContent(element, 'sfdl-debug-logs__same-org').classList;

            expect(analyse()).not.toContain('sfdl-debug-logs__analyse_entering');

            click(modeButton(element, 'compare'));
            await wait();

            expect(sameOrg()).toContain('sfdl-debug-logs__compare_entering');
            await wait(400);
            expect(sameOrg()).not.toContain('sfdl-debug-logs__compare_entering');

            click(modeButton(element, 'analyse'));
            await wait();

            expect(analyse()).toContain('sfdl-debug-logs__analyse_entering');
            expect(sameOrg()).not.toContain('sfdl-debug-logs__compare_entering');
            await wait(400);
            expect(analyse()).not.toContain('sfdl-debug-logs__analyse_entering');

            //The mode already on gets no new mark.
            click(modeButton(element, 'analyse'));
            await wait();
            expect(analyse()).not.toContain('sfdl-debug-logs__analyse_entering');
        });

        it('slides the right panel in only when going from the same org to two orgs', async () => {
            const element = await createConsole();
            const scopeButton = (scope) =>
                element.shadowRoot.querySelector(`[data-scope="${scope}"]`);
            const isEntering = () =>
                tabContent(element, 'sfdl-debug-logs__two-orgs').classList.contains(
                    'sfdl-debug-logs__two-orgs_entering'
                );
            click(modeButton(element, 'compare'));
            await wait();
            click(scopeButton('twoOrgs'));
            await wait();

            await wait(450);
            expect(isEntering()).toBe(false);

            click(tab(element, 'compareMetadata'));
            await wait();
            click(tab(element, 'debugLogs'));
            await wait();
            expect(isEntering()).toBe(false);
        });

        it('slides the right panel out before the same org takes its place again', async () => {
            const element = await createConsole();
            const scopeButton = (scope) =>
                element.shadowRoot.querySelector(`[data-scope="${scope}"]`);
            click(modeButton(element, 'compare'));
            await wait();
            click(scopeButton('twoOrgs'));
            await wait(450);

            click(scopeButton('sameOrg'));
            await wait();

            expect(scopeButton('sameOrg').getAttribute('aria-pressed')).toBe(
                'true'
            );
            expect(isShown(element, 'sfdl-debug-logs__two-orgs')).toBe(true);
            expect(
                tabContent(element, 'sfdl-debug-logs__two-orgs').classList
            ).toContain('sfdl-debug-logs__two-orgs_leaving');
            expect(isShown(element, 'sfdl-debug-logs__same-org')).toBe(false);

            await wait(450);

            expect(isShown(element, 'sfdl-debug-logs__two-orgs')).toBe(false);
            expect(isShown(element, 'sfdl-debug-logs__same-org')).toBe(true);
            expect(
                tabContent(element, 'sfdl-debug-logs__two-orgs').classList
            ).not.toContain('sfdl-debug-logs__two-orgs_leaving');
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

    });

    describe('the log list panel', () => {
        const panel = (element) =>
            element.shadowRoot.querySelector('.sfdl-console-log-list-section');

        it('is a side panel with the org picked in place of a title', async () => {
            const element = await createConsole();

            expect(panel(element).tagName.toLowerCase()).toBe(
                'sfdl-side-panel'
            );
            expect(panel(element).title).toBeUndefined();
            expect(panel(element).label).toBe('Log List');
            expect(panel(element).side).toBe('left');
            expect(picklist(element).slot).toBe('header');
            expect(picklist(element).parentElement).toBe(panel(element));
        });

        it('folds on its own, the log details have no toggle of their own', async () => {
            const element = await createConsole();

            panel(element)
                .shadowRoot.querySelector('.sfdl-side-panel__collapse')
                .click();
            await wait();

            expect(
                panel(element).shadowRoot.querySelector(
                    '.sfdl-side-panel__strip-title'
                ).textContent
            ).toBe('Log List');
            expect(css).not.toMatch(/log-list-is-opening|@starting-style/);
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
        const sameOrgComparison = (element) =>
            element.shadowRoot.querySelector(
                '.sfdl-debug-logs__same-org sfdl-compare-logs'
            );

        async function compareTwoLogs(element) {
            logList(element).dispatchEvent(
                new CustomEvent('comparelogs', {
                    detail: { logs: [LEFT_LOG, RIGHT_LOG] }
                })
            );
            await wait();
        }

        it('opens them in the comparison of the same org', async () => {
            const element = await createConsole();
            await selectOrg(element);

            await compareTwoLogs(element);

            expect(sameOrgComparison(element).pair).toEqual({
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
            expect(
                element.shadowRoot
                    .querySelector('.sfdl-debug-logs__same-org')
                    .classList.contains('slds-hide')
            ).toBe(false);
            expect(
                element.shadowRoot
                    .querySelector('.sfdl-debug-logs__analyse')
                    .classList.contains('slds-hide')
            ).toBe(true);
            expect(
                element.shadowRoot
                    .querySelector('[data-scope="sameOrg"]')
                    .getAttribute('aria-pressed')
            ).toBe('true');
        });

        it('leaves the analysis as it was, to go back to', async () => {
            const element = await createConsole();
            await selectOrg(element);

            await compareTwoLogs(element);

            expect(logDetails(element).className).toBe('');
            expect(logList(element)).not.toBeNull();
        });
    });

    describe('monitoring tab', () => {
        it('builds the Monitoring tab the first time it is opened and keeps it after', async () => {
            mockOrgSessions();
            const element = await createConsole();
            expect(element.shadowRoot.querySelector('sfdl-monitoring')).toBeNull();

            click(tab(element, 'monitoring'));
            await wait();

            const monitoring = element.shadowRoot.querySelector('sfdl-monitoring');
            expect(monitoring).not.toBeNull();
            expect(monitoring.orgs).toEqual([
                { label: 'https://acme.my.salesforce.com', value: 'sid-acme' }
            ]);
            expect(
                element.shadowRoot.querySelector('.sfdl-monitoring-tab').classList
            ).toContain('slds-show');

            click(tab(element, 'debugLogs'));
            await wait();

            expect(element.shadowRoot.querySelector('sfdl-monitoring')).not.toBeNull();
            expect(
                element.shadowRoot.querySelector('.sfdl-monitoring-tab').classList
            ).toContain('slds-hide');
        });
    });
});

