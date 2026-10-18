import { createElement } from 'lwc';
import CompareOrgs from 'sfdl/compareOrgs';
import { getCommonApiVersion } from 'sfdl/salesforceConnection';
import { listOrgComponents, compareComponents } from 'sfdl/orgCompare';

// Object.assign rather than a spread: the transform turns a spread into a
// helper the hoisted factory cannot reach.
jest.mock('sfdl/salesforceConnection', () =>
    Object.assign({}, jest.requireActual('sfdl/salesforceConnection'), {
        getCommonApiVersion: jest.fn()
    })
);
jest.mock('sfdl/orgCompare', () =>
    Object.assign({}, jest.requireActual('sfdl/orgCompare'), {
        listOrgComponents: jest.fn(),
        compareComponents: jest.fn()
    })
);

const ACME = {
    instanceUrl: 'https://acme.my.salesforce.com',
    authToken: 'sid-acme',
    queryWhere: "WHERE Status = 'Success'"
};
const ORGS = [
    { label: 'https://acme.my.salesforce.com', value: 'sid-acme' },
    { label: 'https://globex.my.salesforce.com', value: 'sid-globex' },
    { label: 'https://initech.my.salesforce.com', value: 'sid-initech' }
];
const INITECH = {
    instanceUrl: 'https://initech.my.salesforce.com',
    authToken: 'sid-initech'
};
const GLOBEX = {
    instanceUrl: 'https://globex.my.salesforce.com',
    authToken: 'sid-globex'
};
const ACME_SESSION = {
    instanceUrl: ACME.instanceUrl,
    authToken: ACME.authToken
};

const LISTED_ON = '2026-10-12T09:30:00.000Z';
const text = (content) => ({ content, isBinary: false });
const listed = (name, by = 'Jane Roe') => ({
    name,
    lastModifiedDate: '2026-10-12T09:30:00.000Z',
    lastModifiedByName: by
});

function wait(milliseconds = 0) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function mockListings(namesByOrg) {
    listOrgComponents.mockImplementation((session) =>
        Promise.resolve(
            (namesByOrg[session.instanceUrl] || []).map((name) => listed(name))
        )
    );
}

// Compares as the engine would: the files of each org by component name.
function mockContents(filesByOrg) {
    const { compareFileSets } = jest.requireActual('sfdl/orgCompare');
    compareComponents.mockImplementation(
        (left, right, type, apiVersion, components) => {
            const filesOf = (session, name) =>
                new Map(
                    Object.entries(filesByOrg[session.instanceUrl] || {})
                        .filter(([path]) => path.includes('/' + name + '.'))
                        .map(([path, file]) => [
                            path,
                            typeof file === 'string' ? text(file) : file
                        ])
                );
            const compared = new Map(
                components.map(({ name, presence }) => {
                    const entries = compareFileSets(
                        filesOf(left, name),
                        filesOf(right, name)
                    );
                    const status =
                        presence !== 'both'
                            ? presence
                            : entries.every(
                                  (entry) => entry.status === 'identical'
                              )
                            ? 'identical'
                            : 'different';
                    return [name, { status, entries }];
                })
            );
            return Promise.resolve({
                components: compared,
                left: { problems: [] },
                right: { problems: [] }
            });
        }
    );
}

async function createCompareOrgs(properties = {}) {
    const element = createElement('sfdl-compare-orgs', { is: CompareOrgs });
    Object.assign(element, {
        orgs: ORGS,
        sessionInformation: ACME,
        height: 600,
        ...properties
    });
    document.body.appendChild(element);
    await wait();
    return element;
}

const picker = (element, name) =>
    element.shadowRoot.querySelector('.sfdl-compare-orgs__' + name);
const diffViewer = (element) =>
    element.shadowRoot.querySelector('sfdl-diff-viewer');
const results = (element) =>
    element.shadowRoot.querySelector('sfdl-compare-results');
const resultsPanel = (element) =>
    element.shadowRoot.querySelector('.sfdl-compare-orgs__results-panel');
const statuses = (element) =>
    results(element).components.map(({ name, status }) => name + ' ' + status);
const progressText = (element) =>
    [
        ...element.shadowRoot.querySelectorAll(
            '.sfdl-compare-orgs__progress-row'
        )
    ].map((row) =>
        [
            row.dataset.side,
            row.querySelector('.sfdl-compare-orgs__progress-status').textContent
        ].join(' | ')
    );

async function pick(element, name, value) {
    picker(element, name).dispatchEvent(
        new CustomEvent('change', { detail: { value } })
    );
    await wait();
    await wait();
}

async function listType(type = 'ApexClass', properties) {
    const element = await createCompareOrgs(properties);
    await pick(element, 'right-org', GLOBEX.instanceUrl);
    await pick(element, 'type', type);
    return element;
}

async function openComponent(element, name) {
    results(element).dispatchEvent(
        new CustomEvent('componentopen', { detail: { name } })
    );
    await wait();
    await wait();
}

describe('sfdl-compare-orgs', () => {
    beforeEach(() => {
        getCommonApiVersion.mockResolvedValue('60.0');
        mockListings({});
        mockContents({});
    });

    describe('toolbar', () => {
        it('offers each side the orgs the other side has not taken, and every type', async () => {
            const element = await createCompareOrgs();
            await pick(element, 'right-org', GLOBEX.instanceUrl);

            expect(picker(element, 'left-org').options).toEqual([
                { label: 'acme.my.salesforce.com', value: ORGS[0].label },
                { label: 'initech.my.salesforce.com', value: ORGS[2].label }
            ]);
            expect(picker(element, 'right-org').options).toEqual([
                { label: 'globex.my.salesforce.com', value: ORGS[1].label },
                { label: 'initech.my.salesforce.com', value: ORGS[2].label }
            ]);
            expect(picker(element, 'right-org').side).toBe('right');
            expect(picker(element, 'type').options).toEqual(
                expect.arrayContaining([
                    {
                        label: 'Apex Classes',
                        value: 'ApexClass',
                        group: 'Code'
                    },
                    {
                        label: 'Custom Settings',
                        value: 'CustomSettings',
                        group: 'Data model'
                    }
                ])
            );
        });

        it('ignores an org the other side has taken', async () => {
            const element = await createCompareOrgs();
            await pick(element, 'right-org', GLOBEX.instanceUrl);

            await pick(element, 'left-org', GLOBEX.instanceUrl);

            expect(picker(element, 'left-org').value).toBe(ACME.instanceUrl);
        });

        it('starts the left side on the org of the header', async () => {
            const element = await createCompareOrgs();

            expect(picker(element, 'left-org').value).toBe(ACME.instanceUrl);
            expect(picker(element, 'right-org').value).toBeUndefined();
            expect(
                element.shadowRoot.querySelector('.sfdl-compare-orgs__hint')
                    .textContent
            ).toBe('Pick the two orgs to compare.');
        });

        it('takes the header org for the left side when it comes later', async () => {
            const element = await createCompareOrgs({
                sessionInformation: undefined
            });

            element.sessionInformation = ACME;
            await wait();

            expect(picker(element, 'left-org').value).toBe(ACME.instanceUrl);
        });

        it('asks for the metadata once both orgs are picked', async () => {
            const element = await createCompareOrgs();

            await pick(element, 'right-org', GLOBEX.instanceUrl);

            expect(diffViewer(element).emptyMessage).toBe(
                'Pick the metadata to compare.'
            );
            expect(listOrgComponents).not.toHaveBeenCalled();
        });

        it('names each side of the diff after its org', async () => {
            const element = await createCompareOrgs();

            await pick(element, 'right-org', GLOBEX.instanceUrl);

            expect(diffViewer(element).leftLabel).toBe(
                'acme.my.salesforce.com'
            );
            expect(diffViewer(element).rightLabel).toBe(
                'globex.my.salesforce.com'
            );
        });
    });

    describe('listing', () => {
        it('lists the names both orgs hold as soon as the metadata is picked, and retrieves nothing', async () => {
            mockListings({
                [ACME.instanceUrl]: ['AccountService', 'InvoiceBatch', 'Utils'],
                [GLOBEX.instanceUrl]: [
                    'AccountService',
                    'LegacyHelper',
                    'Utils'
                ]
            });

            const element = await listType();

            expect(getCommonApiVersion).toHaveBeenCalledWith(
                ACME_SESSION,
                GLOBEX
            );
            expect(
                listOrgComponents.mock.calls.map(
                    ([session, type, apiVersion]) => [
                        session.instanceUrl,
                        type.key,
                        apiVersion
                    ]
                )
            ).toEqual([
                [ACME.instanceUrl, 'ApexClass', '60.0'],
                [GLOBEX.instanceUrl, 'ApexClass', '60.0']
            ]);
            expect(compareComponents).not.toHaveBeenCalled();
            expect(statuses(element)).toEqual([
                'AccountService notCompared',
                'InvoiceBatch left',
                'LegacyHelper right',
                'Utils notCompared'
            ]);
            expect(results(element).components[0]).toMatchObject({
                presence: 'both',
                leftModified: {
                    date: '2026-10-12T09:30:00.000Z',
                    by: 'Jane Roe'
                },
                rightModified: {
                    date: '2026-10-12T09:30:00.000Z',
                    by: 'Jane Roe'
                }
            });
        });

        it('says it is listing until both orgs answered', async () => {
            listOrgComponents.mockImplementation(() => new Promise(() => {}));

            const element = await listType();

            expect(progressText(element)).toEqual([
                'left | Listing the components',
                'right | Listing the components'
            ]);
            expect(diffViewer(element).loading).toBe(true);
            expect(diffViewer(element).emptyMessage).toBe(
                'Listing the Apex Classes of both orgs...'
            );
        });

        it('leaves the where clause of the header out', async () => {
            await listType();

            expect(listOrgComponents.mock.calls[0][0]).toEqual(ACME_SESSION);
        });

        it('shows why an org could not be listed', async () => {
            listOrgComponents.mockImplementation((session) =>
                session.instanceUrl === GLOBEX.instanceUrl
                    ? Promise.reject(
                          new Error('INVALID_SESSION_ID: Invalid Session ID')
                      )
                    : Promise.resolve([])
            );

            const element = await listType();

            expect(progressText(element)[1]).toBe(
                'right | INVALID_SESSION_ID: Invalid Session ID'
            );
            expect(results(element)).toBeNull();
        });

        it('shows why the orgs could not be compared at all', async () => {
            getCommonApiVersion.mockRejectedValue(
                new Error('The orgs do not share any api version')
            );

            const element = await listType();

            expect(
                element.shadowRoot.querySelector('.sfdl-compare-orgs__error')
                    .textContent
            ).toBe('The orgs do not share any api version');
        });

        it('lists again when the type or an org changes', async () => {
            const element = await listType();

            await pick(element, 'type', 'ApexTrigger');
            await pick(element, 'left-org', INITECH.instanceUrl);

            expect(
                listOrgComponents.mock.calls.map(([session, type]) =>
                    [session.instanceUrl, type.key].join(' ')
                )
            ).toEqual([
                ACME.instanceUrl + ' ApexClass',
                GLOBEX.instanceUrl + ' ApexClass',
                ACME.instanceUrl + ' ApexTrigger',
                GLOBEX.instanceUrl + ' ApexTrigger',
                INITECH.instanceUrl + ' ApexTrigger',
                GLOBEX.instanceUrl + ' ApexTrigger'
            ]);
        });

        it('keeps the orgs in the toolbar and what to compare under the components title', async () => {
            const element = await createCompareOrgs();
            const toolbar = element.shadowRoot.querySelector(
                '.sfdl-compare-orgs__toolbar'
            );

            expect(
                [...toolbar.children].map(
                    (child) => child.className.split(' ')[0]
                )
            ).toEqual([
                'sfdl-compare-orgs__org',
                'sfdl-compare-orgs__swap',
                'sfdl-compare-orgs__org'
            ]);
            const typePicker = resultsPanel(element).querySelector(
                '.sfdl-compare-orgs__type'
            );
            expect(typePicker.getAttribute('slot')).toBe('header');
            expect(typePicker.label).toBeUndefined();
            expect(resultsPanel(element).title).toBe('Components');
            expect(resultsPanel(element).subtitle).toBeUndefined();
            expect(
                element.shadowRoot.querySelector(
                    '.sfdl-compare-orgs__managed-checkbox'
                )
            ).toBeNull();
        });

        it('swaps the orgs of both sides', async () => {
            const element = await listType();

            picker(element, 'swap').click();
            await wait();
            await wait();

            expect(picker(element, 'left-org').value).toBe(GLOBEX.instanceUrl);
            expect(picker(element, 'right-org').value).toBe(ACME.instanceUrl);
            expect(listOrgComponents.mock.calls[2][0].instanceUrl).toBe(
                GLOBEX.instanceUrl
            );
        });

        it('drops a listing that a newer one overtook', async () => {
            const pendingApexClasses = [];
            listOrgComponents.mockImplementation((session, type) =>
                type.key === 'ApexClass'
                    ? new Promise((resolve) =>
                          pendingApexClasses.push(() =>
                              resolve([listed('Old')])
                          )
                      )
                    : Promise.resolve([listed('New')])
            );
            const element = await listType('ApexClass');

            await pick(element, 'type', 'ApexTrigger');
            pendingApexClasses.forEach((finish) => finish());
            await wait();

            expect(statuses(element)).toEqual(['New notCompared']);
        });
    });

    describe('comparing on demand', () => {
        const LISTINGS = {
            [ACME.instanceUrl]: ['AccountService', 'InvoiceBatch', 'Utils'],
            [GLOBEX.instanceUrl]: ['AccountService', 'LegacyHelper', 'Utils']
        };
        const FILES = {
            [ACME.instanceUrl]: {
                'classes/AccountService.cls':
                    'public class AccountService { left }',
                'classes/AccountService.cls-meta.xml':
                    '<?xml version="1.0"?><ApexClass/>',
                'classes/InvoiceBatch.cls': 'public class InvoiceBatch {}',
                'classes/Utils.cls': 'same'
            },
            [GLOBEX.instanceUrl]: {
                'classes/AccountService.cls':
                    'public class AccountService { right }',
                'classes/AccountService.cls-meta.xml':
                    '<?xml version="1.0"?><ApexClass/>',
                'classes/LegacyHelper.cls': 'public class LegacyHelper {}',
                'classes/Utils.cls': 'same'
            }
        };

        beforeEach(() => {
            mockListings(LISTINGS);
            mockContents(FILES);
        });

        it('compares a component when it is opened, and only that one', async () => {
            const element = await listType();

            await openComponent(element, 'AccountService');

            expect(compareComponents).toHaveBeenCalledTimes(1);
            expect(compareComponents.mock.calls[0].slice(0, 5)).toEqual([
                ACME_SESSION,
                GLOBEX,
                expect.objectContaining({ key: 'ApexClass' }),
                '60.0',
                [
                    {
                        name: 'AccountService',
                        presence: 'both',
                        leftVersion: LISTED_ON,
                        rightVersion: LISTED_ON
                    }
                ]
            ]);
            expect(statuses(element)[0]).toBe('AccountService different');
        });

        it('opens the component on its first difference', async () => {
            const element = await listType();

            await openComponent(element, 'AccountService');

            expect(results(element).selectedName).toBe('AccountService');
            expect(results(element).selectedPath).toBe(
                'classes/AccountService.cls'
            );
            expect(diffViewer(element).leftContent).toBe(
                'public class AccountService { left }'
            );
            expect(diffViewer(element).rightContent).toBe(
                'public class AccountService { right }'
            );
            expect(diffViewer(element).language).toBe('apex');
        });

        it('shows the spinner while the component on screen is retrieved', async () => {
            compareComponents.mockImplementation(() => new Promise(() => {}));
            const element = await listType();

            await openComponent(element, 'Utils');

            expect(statuses(element)[3]).toBe('Utils comparing');
            expect(diffViewer(element).loading).toBe(true);
            expect(diffViewer(element).emptyMessage).toBe(
                'Retrieving Utils from both orgs...'
            );
        });

        it('opens a component compared before without retrieving it again', async () => {
            const element = await listType();
            await openComponent(element, 'Utils');

            await openComponent(element, 'AccountService');
            await openComponent(element, 'Utils');

            expect(compareComponents).toHaveBeenCalledTimes(2);
            expect(diffViewer(element).identicalMessage).toBe(
                'classes/Utils.cls is identical in both orgs.'
            );
        });

        it('opens the file picked in the list', async () => {
            const element = await listType();
            await openComponent(element, 'AccountService');

            results(element).dispatchEvent(
                new CustomEvent('fileopen', {
                    detail: {
                        name: 'AccountService',
                        path: 'classes/AccountService.cls-meta.xml'
                    }
                })
            );
            await wait();

            expect(diffViewer(element).language).toBe('xml');
            expect(diffViewer(element).leftContent).toContain('<ApexClass/>');
        });

        it('retrieves a component one org lacks from the other org only, and says so', async () => {
            const element = await listType();

            await openComponent(element, 'LegacyHelper');

            expect(compareComponents.mock.calls[0][4]).toEqual([
                {
                    name: 'LegacyHelper',
                    presence: 'right',
                    leftVersion: undefined,
                    rightVersion: LISTED_ON
                }
            ]);
            expect(diffViewer(element).leftContent).toBeUndefined();
            expect(diffViewer(element).rightContent).toBe(
                'public class LegacyHelper {}'
            );
            expect(diffViewer(element).notice).toBe(
                'classes/LegacyHelper.cls is only in globex.my.salesforce.com.'
            );
        });

        it('runs one comparison at a time', async () => {
            const pending = [];
            compareComponents.mockImplementation(
                (left, right, type, apiVersion, components) =>
                    new Promise((resolve) =>
                        pending.push(() =>
                            resolve({
                                components: new Map(
                                    components.map(({ name }) => [
                                        name,
                                        { status: 'identical', entries: [] }
                                    ])
                                ),
                                left: { problems: [] },
                                right: { problems: [] }
                            })
                        )
                    )
            );
            const element = await listType();

            await openComponent(element, 'AccountService');
            await openComponent(element, 'Utils');

            expect(compareComponents).toHaveBeenCalledTimes(1);

            pending.shift()();
            await wait();
            await wait();

            expect(compareComponents).toHaveBeenCalledTimes(2);
        });

        it('shows how far each org got while retrieving', async () => {
            compareComponents.mockImplementation(
                (left, right, type, apiVersion, components, options) => {
                    options.onStatus('left', 'InProgress');
                    options.onStatus('right', 'Pending');
                    return new Promise(() => {});
                }
            );
            const element = await listType();

            await openComponent(element, 'Utils');

            expect(progressText(element)).toEqual([
                'left | Retrieving',
                'right | Queued in the org'
            ]);
        });

        it('tells where each org stands over the diff, not in the list of components', async () => {
            compareComponents.mockImplementation(() => new Promise(() => {}));
            const element = await listType();

            await openComponent(element, 'Utils');

            const progress = element.shadowRoot.querySelector(
                '.sfdl-compare-orgs__progress'
            );
            expect(progress.parentElement.classList).toContain(
                'sfdl-compare-orgs__diff'
            );
            expect(
                resultsPanel(element).querySelector(
                    '.sfdl-compare-orgs__progress'
                )
            ).toBeNull();
            expect(
                [...progress.children].map((row) => row.dataset.side)
            ).toEqual(['left', 'right']);
        });

        it('shows the org that failed and leaves the components as they were', async () => {
            compareComponents.mockResolvedValue({
                components: new Map(),
                left: { problems: [] },
                right: { error: 'INVALID_SESSION_ID: Invalid Session ID' }
            });
            const element = await listType();

            await openComponent(element, 'Utils');

            expect(progressText(element)[1]).toBe(
                'right | INVALID_SESSION_ID: Invalid Session ID'
            );
            expect(statuses(element)[3]).toBe('Utils notCompared');
        });

        it('says which components an org could not hand back', async () => {
            compareComponents.mockResolvedValue({
                components: new Map([
                    ['Utils', { status: 'identical', entries: [] }]
                ]),
                left: {
                    problems: [
                        'Entity of type ApexClass named Utils cannot be found'
                    ]
                },
                right: { problems: [] }
            });
            const element = await listType();

            await openComponent(element, 'Utils');
            const leftStatus = element.shadowRoot.querySelector(
                '.sfdl-compare-orgs__progress-status'
            );

            expect(leftStatus.textContent).toBe(
                '1 component could not be retrieved'
            );
            expect(leftStatus.title).toBe(
                'Entity of type ApexClass named Utils cannot be found'
            );
        });

        it('drops a comparison of a listing that was replaced', async () => {
            const pending = [];
            compareComponents.mockImplementation(
                () =>
                    new Promise((resolve) =>
                        pending.push(() =>
                            resolve({
                                components: new Map([
                                    [
                                        'Utils',
                                        { status: 'different', entries: [] }
                                    ]
                                ]),
                                left: { problems: [] },
                                right: { problems: [] }
                            })
                        )
                    )
            );
            mockListings({
                [ACME.instanceUrl]: ['Utils'],
                [GLOBEX.instanceUrl]: ['Utils']
            });
            const element = await listType('ApexClass');
            await openComponent(element, 'Utils');

            await pick(element, 'type', 'ApexTrigger');
            pending.forEach((finish) => finish());
            await wait();

            expect(statuses(element)).toEqual(['Utils notCompared']);
        });

        it('stands a binary file in for its size', async () => {
            mockListings({
                [ACME.instanceUrl]: ['logo'],
                [GLOBEX.instanceUrl]: ['logo']
            });
            mockContents({
                [ACME.instanceUrl]: {
                    'staticresources/logo.resource': {
                        content: 'AAAAAAAA',
                        isBinary: true
                    }
                },
                [GLOBEX.instanceUrl]: {
                    'staticresources/logo.resource': {
                        content: 'BBBBBBBBBB==',
                        isBinary: true
                    }
                }
            });
            const element = await listType('StaticResource');

            await openComponent(element, 'logo');

            expect(diffViewer(element).leftContent).toBe(
                'Binary file of 6 bytes'
            );
            expect(diffViewer(element).rightContent).toBe(
                'Binary file of 7 bytes'
            );
            expect(diffViewer(element).language).toBe('plaintext');
            expect(diffViewer(element).notice).toBe(
                'staticresources/logo.resource is a binary file, its contents differ in both orgs.'
            );
        });

        it('empties the diff when the listing changes', async () => {
            const element = await listType();
            await openComponent(element, 'AccountService');

            await pick(element, 'type', 'ApexTrigger');

            expect(diffViewer(element).leftContent).toBeUndefined();
            expect(diffViewer(element).rightContent).toBeUndefined();
        });
    });
});
