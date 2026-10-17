import { createElement } from 'lwc';
import CompareOrgs from 'sfdl/compareOrgs';
import { getCommonApiVersion } from 'sfdl/salesforceConnection';
import { retrieveOrgFiles } from 'sfdl/orgCompare';

// Object.assign rather than a spread: the transform turns a spread into a
// helper the hoisted factory cannot reach.
jest.mock('sfdl/salesforceConnection', () =>
    Object.assign({}, jest.requireActual('sfdl/salesforceConnection'), {
        getCommonApiVersion: jest.fn()
    })
);
jest.mock('sfdl/orgCompare', () =>
    Object.assign({}, jest.requireActual('sfdl/orgCompare'), {
        retrieveOrgFiles: jest.fn()
    })
);

const ACME = {
    instanceUrl: 'https://acme.my.salesforce.com',
    authToken: 'sid-acme',
    queryWhere: "WHERE Status = 'Success'"
};
const ORGS = [
    { label: 'https://acme.my.salesforce.com', value: 'sid-acme' },
    { label: 'https://globex.my.salesforce.com', value: 'sid-globex' }
];
const GLOBEX = {
    instanceUrl: 'https://globex.my.salesforce.com',
    authToken: 'sid-globex'
};

const text = (content) => ({ content, isBinary: false });

function wait(milliseconds = 0) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function mockOrgFiles(filesByOrg) {
    retrieveOrgFiles.mockImplementation((session) =>
        Promise.resolve({
            files: new Map(
                Object.entries(filesByOrg[session.instanceUrl] || {})
            ),
            problems: []
        })
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

async function pick(element, name, value) {
    picker(element, name).dispatchEvent(
        new CustomEvent('change', { detail: { value } })
    );
    await wait();
    await wait();
}

describe('sfdl-compare-orgs', () => {
    beforeEach(() => {
        getCommonApiVersion.mockResolvedValue('60.0');
        mockOrgFiles({});
    });

    describe('toolbar', () => {
        it('offers every org session on both sides and every type', async () => {
            const element = await createCompareOrgs();

            expect(picker(element, 'left-org').options).toEqual([
                { label: 'acme.my.salesforce.com', value: ORGS[0].label },
                { label: 'globex.my.salesforce.com', value: ORGS[1].label }
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

        it('starts the left side on the org of the header', async () => {
            const element = await createCompareOrgs();

            expect(picker(element, 'left-org').value).toBe(ACME.instanceUrl);
            expect(picker(element, 'right-org').value).toBeUndefined();
            expect(diffViewer(element).emptyMessage).toBe(
                'Pick the two orgs to compare.'
            );
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
            expect(retrieveOrgFiles).not.toHaveBeenCalled();
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

    describe('running the comparison', () => {
        async function readyToCompare(properties) {
            const element = await createCompareOrgs(properties);
            await pick(element, 'right-org', GLOBEX.instanceUrl);
            return element;
        }

        it('retrieves both orgs as soon as the metadata is picked', async () => {
            const element = await readyToCompare();

            await pick(element, 'type', 'ApexClass');

            expect(getCommonApiVersion).toHaveBeenCalledWith(
                { instanceUrl: ACME.instanceUrl, authToken: ACME.authToken },
                GLOBEX
            );
            expect(
                retrieveOrgFiles.mock.calls.map(
                    ([session, type, apiVersion, options]) => [
                        session.instanceUrl,
                        type.key,
                        apiVersion,
                        options.includeManaged,
                        options.refresh
                    ]
                )
            ).toEqual([
                [ACME.instanceUrl, 'ApexClass', '60.0', false, false],
                [GLOBEX.instanceUrl, 'ApexClass', '60.0', false, false]
            ]);
        });

        it('leaves the where clause of the header out', async () => {
            const element = await readyToCompare();

            await pick(element, 'type', 'ApexClass');

            expect(retrieveOrgFiles.mock.calls[0][0]).toEqual({
                instanceUrl: ACME.instanceUrl,
                authToken: ACME.authToken
            });
        });

        it('shows the spinner until both orgs are retrieved', async () => {
            const pendingRetrieves = [];
            retrieveOrgFiles.mockImplementation(
                () =>
                    new Promise((resolve) => {
                        pendingRetrieves.push(() =>
                            resolve({ files: new Map(), problems: [] })
                        );
                    })
            );
            const element = await readyToCompare();

            await pick(element, 'type', 'ApexClass');

            expect(diffViewer(element).loading).toBe(true);
            expect(diffViewer(element).emptyMessage).toBe(
                'Retrieving Apex Classes from both orgs...'
            );

            pendingRetrieves.forEach((finishRetrieve) => finishRetrieve());
            await wait();

            expect(diffViewer(element).loading).toBe(false);
        });

        it('compares again when the type, an org or the managed choice changes', async () => {
            const element = await readyToCompare();
            await pick(element, 'type', 'ApexClass');

            await pick(element, 'type', 'ApexTrigger');
            await pick(element, 'left-org', GLOBEX.instanceUrl);
            const managed = element.shadowRoot.querySelector(
                '.sfdl-compare-orgs__managed-checkbox'
            );
            managed.checked = true;
            managed.dispatchEvent(new CustomEvent('change'));
            await wait();
            await wait();

            expect(
                retrieveOrgFiles.mock.calls.map(([session, type, , options]) =>
                    [
                        session.instanceUrl,
                        type.key,
                        options.includeManaged
                    ].join(' ')
                )
            ).toEqual([
                ACME.instanceUrl + ' ApexClass false',
                GLOBEX.instanceUrl + ' ApexClass false',
                ACME.instanceUrl + ' ApexTrigger false',
                GLOBEX.instanceUrl + ' ApexTrigger false',
                GLOBEX.instanceUrl + ' ApexTrigger false',
                GLOBEX.instanceUrl + ' ApexTrigger false',
                GLOBEX.instanceUrl + ' ApexTrigger true',
                GLOBEX.instanceUrl + ' ApexTrigger true'
            ]);
        });

        it('retrieves both orgs again on refresh', async () => {
            const element = await readyToCompare();
            await pick(element, 'type', 'ApexClass');

            picker(element, 'refresh').click();
            await wait();
            await wait();

            expect(
                retrieveOrgFiles.mock.calls
                    .slice(2)
                    .map(([, , , options]) => options.refresh)
            ).toEqual([true, true]);
        });

        it('cannot refresh before there is something to compare', async () => {
            const element = await createCompareOrgs();

            expect(picker(element, 'refresh').disabled).toBe(true);
        });

        it('swaps the orgs of both sides and compares them the other way round', async () => {
            const element = await readyToCompare();
            await pick(element, 'type', 'ApexClass');

            picker(element, 'swap').click();
            await wait();
            await wait();

            expect(picker(element, 'left-org').value).toBe(GLOBEX.instanceUrl);
            expect(picker(element, 'right-org').value).toBe(ACME.instanceUrl);
            expect(retrieveOrgFiles.mock.calls[2][0].instanceUrl).toBe(
                GLOBEX.instanceUrl
            );
        });
    });

    describe('results', () => {
        const results = (element) =>
            element.shadowRoot.querySelector('sfdl-compare-results');
        const resultsPanel = (element) =>
            element.shadowRoot.querySelector(
                '.sfdl-compare-orgs__results-panel'
            );
        const progressRows = (element) => [
            ...element.shadowRoot.querySelectorAll(
                '.sfdl-compare-orgs__progress-row'
            )
        ];
        const progressText = (element) =>
            progressRows(element).map((row) =>
                [
                    row.dataset.side,
                    row.querySelector('.sfdl-compare-orgs__progress-org')
                        .textContent,
                    row.querySelector('.sfdl-compare-orgs__progress-status')
                        .textContent
                ].join(' | ')
            );

        async function compare(type = 'ApexClass') {
            const element = await createCompareOrgs();
            await pick(element, 'right-org', GLOBEX.instanceUrl);
            await pick(element, 'type', type);
            return element;
        }

        it('lists every component of both orgs with its status', async () => {
            mockOrgFiles({
                [ACME.instanceUrl]: {
                    'classes/A.cls': text('same'),
                    'classes/B.cls': text('left')
                },
                [GLOBEX.instanceUrl]: {
                    'classes/A.cls': text('same'),
                    'classes/B.cls': text('right'),
                    'classes/C.cls': text('new')
                }
            });

            const element = await compare();

            expect(
                results(element).entries.map(
                    ({ path, status }) => path + ' ' + status
                )
            ).toEqual([
                'classes/A.cls identical',
                'classes/B.cls different',
                'classes/C.cls right'
            ]);
            expect(results(element).typeLabel).toBe('Apex Classes');
            expect(results(element).leftName).toBe('acme.my.salesforce.com');
            expect(resultsPanel(element).subtitle).toBe(
                'Apex Classes \u00b7 API 60.0'
            );
        });

        it('shows how far each org got while retrieving', async () => {
            retrieveOrgFiles.mockImplementation(
                (session, type, apiVersion, options) => {
                    options.onStatus(
                        session.instanceUrl === ACME.instanceUrl
                            ? 'InProgress'
                            : 'Pending'
                    );
                    return new Promise(() => {});
                }
            );

            const element = await compare();

            expect(progressText(element)).toEqual([
                'left | acme.my.salesforce.com | Retrieving',
                'right | globex.my.salesforce.com | Queued in the org'
            ]);
            expect(results(element)).toBeNull();
        });

        it('shows why an org could not be retrieved', async () => {
            retrieveOrgFiles.mockImplementation((session) =>
                session.instanceUrl === GLOBEX.instanceUrl
                    ? Promise.reject(
                          new Error('INVALID_SESSION_ID: Invalid Session ID')
                      )
                    : Promise.resolve({ files: new Map(), problems: [] })
            );

            const element = await compare();

            expect(progressText(element)[1]).toBe(
                'right | globex.my.salesforce.com | INVALID_SESSION_ID: Invalid Session ID'
            );
            expect(
                progressRows(element)[1]
                    .querySelector('.sfdl-compare-orgs__progress-status')
                    .classList.contains(
                        'sfdl-compare-orgs__progress-status_error'
                    )
            ).toBe(true);
            expect(results(element)).toBeNull();
        });

        it('says which components an org could not hand back', async () => {
            retrieveOrgFiles.mockImplementation((session) =>
                Promise.resolve({
                    files: new Map([['classes/A.cls', text('a')]]),
                    problems:
                        session.instanceUrl === ACME.instanceUrl
                            ? [
                                  'Entity of type ApexClass named Gone cannot be found',
                                  'Another one'
                              ]
                            : []
                })
            );

            const element = await compare();
            const leftStatus = progressRows(element)[0].querySelector(
                '.sfdl-compare-orgs__progress-status'
            );

            expect(leftStatus.textContent).toBe(
                '2 components could not be retrieved'
            );
            expect(leftStatus.title).toBe(
                'Entity of type ApexClass named Gone cannot be found\nAnother one'
            );
            expect(results(element)).not.toBeNull();
        });

        it('shows why the orgs could not be compared at all', async () => {
            getCommonApiVersion.mockRejectedValue(
                new Error('The orgs do not share any api version')
            );

            const element = await compare();

            expect(
                element.shadowRoot.querySelector('.sfdl-compare-orgs__error')
                    .textContent
            ).toBe('The orgs do not share any api version');
        });

        it('drops a comparison that a newer one overtook', async () => {
            const pendingApexClasses = [];
            retrieveOrgFiles.mockImplementation((session, type) =>
                type.key === 'ApexClass'
                    ? new Promise((resolve) =>
                          pendingApexClasses.push(() =>
                              resolve({
                                  files: new Map([
                                      ['classes/Old.cls', text('a')]
                                  ]),
                                  problems: []
                              })
                          )
                      )
                    : Promise.resolve({
                          files: new Map([['triggers/New.trigger', text('b')]]),
                          problems: []
                      })
            );
            const element = await compare('ApexClass');

            await pick(element, 'type', 'ApexTrigger');
            pendingApexClasses.forEach((finish) => finish());
            await wait();

            expect(results(element).entries.map(({ path }) => path)).toEqual([
                'triggers/New.trigger'
            ]);
        });

        it('marks the component picked in the list', async () => {
            mockOrgFiles({
                [ACME.instanceUrl]: { 'classes/A.cls': text('a') }
            });
            const element = await compare();

            results(element).dispatchEvent(
                new CustomEvent('componentselect', {
                    detail: { path: 'classes/A.cls' }
                })
            );
            await wait();

            expect(results(element).selectedPath).toBe('classes/A.cls');
        });

        it('explains in the panel what is missing before comparing', async () => {
            const element = await createCompareOrgs();

            expect(
                element.shadowRoot.querySelector('.sfdl-compare-orgs__hint')
                    .textContent
            ).toBe('Pick the two orgs to compare.');
            expect(resultsPanel(element).subtitle).toBe('Nothing compared yet');
        });
    });

    describe('the diff of a component', () => {
        const results = (element) =>
            element.shadowRoot.querySelector('sfdl-compare-results');

        async function compare(filesByOrg, type = 'ApexClass') {
            mockOrgFiles(filesByOrg);
            const element = await createCompareOrgs();
            await pick(element, 'right-org', GLOBEX.instanceUrl);
            await pick(element, 'type', type);
            return element;
        }

        async function open(element, path) {
            results(element).dispatchEvent(
                new CustomEvent('componentselect', { detail: { path } })
            );
            await wait();
        }

        it('opens on the first change as soon as the orgs are compared', async () => {
            const element = await compare({
                [ACME.instanceUrl]: {
                    'classes/A.cls': text('same'),
                    'classes/B.cls': text('public class B { left }')
                },
                [GLOBEX.instanceUrl]: {
                    'classes/A.cls': text('same'),
                    'classes/B.cls': text('public class B { right }')
                }
            });

            expect(results(element).selectedPath).toBe('classes/B.cls');
            expect(diffViewer(element).leftContent).toBe(
                'public class B { left }'
            );
            expect(diffViewer(element).rightContent).toBe(
                'public class B { right }'
            );
            expect(diffViewer(element).language).toBe('apex');
            expect(diffViewer(element).notice).toBeUndefined();
        });

        it('opens on the first component when the orgs are identical', async () => {
            const element = await compare(
                {
                    [ACME.instanceUrl]: {
                        'pages/Invoice.page': text('<apex:page/>')
                    },
                    [GLOBEX.instanceUrl]: {
                        'pages/Invoice.page': text('<apex:page/>')
                    }
                },
                'ApexPage'
            );

            expect(diffViewer(element).leftContent).toBe('<apex:page/>');
            expect(diffViewer(element).rightContent).toBe('<apex:page/>');
            expect(diffViewer(element).language).toBe('html');
            expect(diffViewer(element).identicalMessage).toBe(
                'pages/Invoice.page is identical in both orgs.'
            );
        });

        it('shows the component picked in the list', async () => {
            const element = await compare({
                [ACME.instanceUrl]: {
                    'classes/A.cls': text('a'),
                    'classes/A.cls-meta.xml': text(
                        '<?xml version="1.0"?><ApexClass/>'
                    )
                },
                [GLOBEX.instanceUrl]: {
                    'classes/A.cls': text('b'),
                    'classes/A.cls-meta.xml': text(
                        '<?xml version="1.0"?><ApexClass/>'
                    )
                }
            });

            await open(element, 'classes/A.cls-meta.xml');

            expect(diffViewer(element).language).toBe('xml');
            expect(diffViewer(element).leftContent).toContain('<ApexClass/>');
        });

        it('says which org holds a component the other one lacks', async () => {
            const element = await compare({
                [ACME.instanceUrl]: { 'classes/OnlyLeft.cls': text('left') },
                [GLOBEX.instanceUrl]: { 'classes/OnlyRight.cls': text('right') }
            });

            expect(diffViewer(element).leftContent).toBe('left');
            expect(diffViewer(element).rightContent).toBeUndefined();
            expect(diffViewer(element).notice).toBe(
                'classes/OnlyLeft.cls is only in acme.my.salesforce.com.'
            );

            await open(element, 'classes/OnlyRight.cls');

            expect(diffViewer(element).leftContent).toBeUndefined();
            expect(diffViewer(element).notice).toBe(
                'classes/OnlyRight.cls is only in globex.my.salesforce.com.'
            );
        });

        it('stands a binary file in for its size', async () => {
            const element = await compare(
                {
                    [ACME.instanceUrl]: {
                        'staticresources/logo.resource': {
                            content: 'AAAAAAAA',
                            isBinary: true
                        }
                    },
                    [GLOBEX.instanceUrl]: {
                        'staticresources/logo.resource': {
                            content: 'BBBBBBBBBBBB',
                            isBinary: true
                        }
                    }
                },
                'StaticResource'
            );

            expect(diffViewer(element).leftContent).toBe(
                'Binary file of 6 bytes'
            );
            expect(diffViewer(element).rightContent).toBe(
                'Binary file of 9 bytes'
            );
            expect(diffViewer(element).language).toBe('plaintext');
            expect(diffViewer(element).notice).toBe(
                'staticresources/logo.resource is a binary file, its contents differ in both orgs.'
            );
        });

        it('empties the diff when a new comparison starts', async () => {
            const element = await compare({
                [ACME.instanceUrl]: { 'classes/A.cls': text('a') },
                [GLOBEX.instanceUrl]: { 'classes/A.cls': text('b') }
            });
            retrieveOrgFiles.mockImplementation(() => new Promise(() => {}));

            await pick(element, 'type', 'ApexTrigger');

            expect(diffViewer(element).leftContent).toBeUndefined();
            expect(diffViewer(element).rightContent).toBeUndefined();
        });
    });
});
