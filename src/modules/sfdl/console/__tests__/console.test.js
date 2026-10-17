import { createElement } from 'lwc';
import Console from 'sfdl/console';

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
        it('renders the org picker, the three tabs and the footer', async () => {
            const element = await createConsole();

            expect(picklist(element)).not.toBeNull();
            expect(
                [
                    ...element.shadowRoot.querySelectorAll(
                        '.slds-tabs_scoped__link'
                    )
                ].map((link) => link.dataset.tabname)
            ).toEqual(['analyseLogs', 'compareLogs', 'compareOrgs']);
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

        it('opens on the analyse logs tab', async () => {
            const element = await createConsole();

            expect(
                tabItem(element, 'liElementAnalyseLogs').classList.contains(
                    'slds-is-active'
                )
            ).toBe(true);
            expect(
                tabContent(element, 'sfdl-analise-logs').classList.contains(
                    'slds-show'
                )
            ).toBe(true);
        });

        it('builds the compare tabs only once they are opened', async () => {
            const element = await createConsole();

            expect(
                element.shadowRoot.querySelector('sfdl-compare-logs')
            ).toBeNull();
            expect(
                element.shadowRoot.querySelector('sfdl-compare-orgs')
            ).toBeNull();
        });

        it.each([
            ['compareLogs', 'liElementCompareLogs', 'sfdl-compare-logs'],
            ['compareOrgs', 'liElementCompareOrgs', 'sfdl-compare-orgs']
        ])(
            'opens the %s tab and hides the analyse logs tab',
            async (tabName, tabHtmlClass, contentHtmlClass) => {
                const element = await createConsole();

                click(tab(element, tabName));
                await wait();

                expect(
                    tabItem(element, tabHtmlClass).classList.contains(
                        'slds-is-active'
                    )
                ).toBe(true);
                expect(
                    tabItem(element, 'liElementAnalyseLogs').classList.contains(
                        'slds-is-active'
                    )
                ).toBe(false);
                expect(
                    tabContent(element, contentHtmlClass).classList.contains(
                        'slds-show'
                    )
                ).toBe(true);
                expect(
                    tabContent(element, 'sfdl-analise-logs').classList.contains(
                        'slds-hide'
                    )
                ).toBe(true);
                expect(
                    element.shadowRoot.querySelector(contentHtmlClass)
                ).not.toBeNull();
            }
        );

        it('keeps every tab it built while another one is open', async () => {
            const element = await createConsole();

            click(tab(element, 'compareLogs'));
            await wait();
            click(tab(element, 'analyseLogs'));
            await wait();

            expect(
                tabContent(element, 'sfdl-analise-logs').classList.contains(
                    'slds-show'
                )
            ).toBe(true);
            expect(
                tabContent(element, 'sfdl-compare-logs').classList.contains(
                    'slds-hide'
                )
            ).toBe(true);
            expect(logDetails(element)).not.toBeNull();
        });

        it('hands the org sessions and the selected org to the compare tabs', async () => {
            const element = await createConsole();
            await selectOrg(element);

            click(tab(element, 'compareLogs'));
            click(tab(element, 'compareOrgs'));
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
});
