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
});
