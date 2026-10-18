import {
    compareFileSets,
    listOrgComponents,
    componentOfPath,
    retrieveComponentFiles,
    compareComponents,
    UNAVAILABLE,
    DIFFERENT,
    LEFT_ONLY,
    RIGHT_ONLY,
    IDENTICAL
} from 'sfdl/orgCompare';
import { getMetadataType } from 'sfdl/metadataCatalog';
import { retrieveFiles, listMetadata } from 'sfdl/metadataApi';
import { listCustomSettings, readCustomSettingFile } from 'sfdl/customSettings';

jest.mock('sfdl/metadataApi', () => ({
    retrieveFiles: jest.fn(),
    listMetadata: jest.fn()
}));
jest.mock('sfdl/customSettings', () => ({
    listCustomSettings: jest.fn(),
    readCustomSettingFile: jest.fn()
}));

const text = (content) => ({ content, isBinary: false });
const files = (entries) => new Map(Object.entries(entries));

let orgCount = 0;
function newOrg() {
    orgCount++;
    return {
        instanceUrl: 'https://org' + orgCount + '.my.salesforce.com',
        authToken: 'sid' + orgCount
    };
}

describe('compareFileSets', () => {
    it('gives every path of either side its status, by path', () => {
        const entries = compareFileSets(
            files({
                'classes/Same.cls': text('a'),
                'classes/Changed.cls': text('left'),
                'classes/OnlyLeft.cls': text('x')
            }),
            files({
                'classes/Same.cls': text('a'),
                'classes/Changed.cls': text('right'),
                'classes/OnlyRight.cls': text('y')
            })
        );

        expect(entries.map(({ path, status }) => [path, status])).toEqual([
            ['classes/Changed.cls', DIFFERENT],
            ['classes/OnlyLeft.cls', LEFT_ONLY],
            ['classes/OnlyRight.cls', RIGHT_ONLY],
            ['classes/Same.cls', IDENTICAL]
        ]);
        expect(entries[1]).toEqual({
            path: 'classes/OnlyLeft.cls',
            status: LEFT_ONLY,
            left: text('x'),
            right: undefined
        });
    });

    it('takes files that only differ in line endings for identical', () => {
        const [entry] = compareFileSets(
            files({ 'classes/A.cls': text('one\r\ntwo\r\n') }),
            files({ 'classes/A.cls': text('one\ntwo\n') })
        );

        expect(entry.status).toBe(IDENTICAL);
        expect(entry.left.content).toBe('one\ntwo\n');
    });

    it('compares binary files by their bytes', () => {
        const entries = compareFileSets(
            files({
                'staticresources/a.resource': {
                    content: 'AAA=',
                    isBinary: true
                },
                'staticresources/b.resource': {
                    content: 'AAA=',
                    isBinary: true
                }
            }),
            files({
                'staticresources/a.resource': {
                    content: 'AAA=',
                    isBinary: true
                },
                'staticresources/b.resource': {
                    content: 'BBB=',
                    isBinary: true
                }
            })
        );

        expect(entries.map(({ status }) => status)).toEqual([
            IDENTICAL,
            DIFFERENT
        ]);
    });
});

describe('listOrgComponents', () => {
    it('lists the names through listMetadata, without retrieving anything', async () => {
        const org = newOrg();
        listMetadata.mockResolvedValue([
            {
                fullName: 'Utils',
                namespacePrefix: '',
                lastModifiedDate: 'd',
                lastModifiedByName: 'n'
            }
        ]);

        await expect(
            listOrgComponents(org, getMetadataType('ApexClass'), '60.0')
        ).resolves.toEqual([
            { name: 'Utils', lastModifiedDate: 'd', lastModifiedByName: 'n' }
        ]);
        expect(retrieveFiles).not.toHaveBeenCalled();
    });

    it('lists custom settings through describeGlobal', async () => {
        const org = newOrg();
        listCustomSettings.mockResolvedValue([{ name: 'A__c' }]);

        await expect(
            listOrgComponents(org, getMetadataType('CustomSettings'), '60.0')
        ).resolves.toEqual([{ name: 'A__c' }]);
        expect(listCustomSettings).toHaveBeenCalledWith(org, '60.0');
        expect(listMetadata).not.toHaveBeenCalled();
    });

    it('lists again every time, the listing tells what changed', async () => {
        const org = newOrg();
        const type = getMetadataType('ApexTrigger');
        listMetadata.mockResolvedValue([]);

        await listOrgComponents(org, type, '60.0');
        await listOrgComponents(org, type, '60.0');

        expect(listMetadata).toHaveBeenCalledTimes(2);
    });
});

describe('componentOfPath', () => {
    it.each([
        ['classes/AccountService.cls', 'AccountService'],
        ['classes/AccountService.cls-meta.xml', 'AccountService'],
        ['objects/Account/fields/Tier__c.field', 'Account'],
        ['objects/Account/Account.object', 'Account'],
        ['objects/Thing__c.object', 'Thing__c'],
        ['workflows/Account/rules/Tier on create.rule', 'Account'],
        ['lwc/invoiceList/invoiceList.js', 'invoiceList'],
        ['aura/Invoice/InvoiceController.js', 'Invoice'],
        ['labels/Greeting.label', 'Greeting'],
        ['customMetadata/Discount_Rule.Gold.md', 'Discount_Rule.Gold'],
        ['layouts/Account-Account Layout.layout', 'Account-Account Layout'],
        ['customSettings/Integration__c.setting', 'Integration__c']
    ])('takes %s for part of %s', (path, name) => {
        expect(componentOfPath(path)).toBe(name);
    });
});

describe('retrieveComponentFiles', () => {
    const at = (name, version = 'v1') => ({ name, version });

    function mockRetrieve(filesByMember) {
        retrieveFiles.mockImplementation((session, apiVersion, [{ members }]) =>
            Promise.resolve({
                files: new Map(
                    members.flatMap((member) =>
                        Object.entries(filesByMember[member] || {}).map(
                            ([path, content]) => [path, text(content)]
                        )
                    )
                ),
                messages: []
            })
        );
    }

    it('retrieves only the components named and groups their files', async () => {
        const org = newOrg();
        mockRetrieve({
            Foo: {
                'classes/Foo.cls': 'foo',
                'classes/Foo.cls-meta.xml': '<m/>'
            },
            Bar: { 'classes/Bar.cls': 'bar' }
        });

        const { files } = await retrieveComponentFiles(
            org,
            getMetadataType('ApexClass'),
            '60.0',
            [at('Foo'), at('Bar')]
        );

        expect(retrieveFiles).toHaveBeenCalledWith(
            org,
            '60.0',
            [{ name: 'ApexClass', members: ['Foo', 'Bar'] }],
            { onStatus: expect.any(Function) }
        );
        expect([...files.get('Foo').keys()]).toEqual([
            'classes/Foo.cls',
            'classes/Foo.cls-meta.xml'
        ]);
        expect([...files.get('Bar').keys()]).toEqual(['classes/Bar.cls']);
    });

    it('splits objects and asks for them a few at a time', async () => {
        const org = newOrg();
        const components = Array.from({ length: 23 }, (value, index) =>
            at('Object' + index + '__c')
        );
        mockRetrieve({});
        const onStatus = jest.fn();

        await retrieveComponentFiles(
            org,
            getMetadataType('CustomObjects'),
            '60.0',
            components,
            { onStatus }
        );

        expect(
            retrieveFiles.mock.calls.map(
                ([, , [{ members }]]) => members.length
            )
        ).toEqual([10, 10, 3]);
        retrieveFiles.mock.calls[1][3].onStatus('InProgress');
        expect(onStatus).toHaveBeenCalledWith('Batch 2 of 3: InProgress');
    });

    it('retrieves a component again only once the org changed it', async () => {
        const org = newOrg();
        const type = getMetadataType('ApexClass');
        mockRetrieve({
            Foo: { 'classes/Foo.cls': 'foo' },
            Bar: { 'classes/Bar.cls': 'bar' }
        });
        const onStatus = jest.fn();

        await retrieveComponentFiles(org, type, '60.0', [at('Foo', 'monday')]);
        await retrieveComponentFiles(org, type, '60.0', [
            at('Foo', 'monday'),
            at('Bar')
        ]);
        await retrieveComponentFiles(org, type, '60.0', [at('Foo', 'monday')], {
            onStatus
        });
        await retrieveComponentFiles(org, type, '60.0', [at('Foo', 'tuesday')]);
        await retrieveComponentFiles(org, type, '60.0', [at('Foo', 'tuesday')]);

        expect(
            retrieveFiles.mock.calls.map(([, , [{ members }]]) => members)
        ).toEqual([['Foo'], ['Bar'], ['Foo']]);
        expect(onStatus).toHaveBeenCalledWith('Already retrieved');
    });

    it('retrieves every time a component no date tells about', async () => {
        const org = newOrg();
        const type = getMetadataType('ApexClass');
        mockRetrieve({ Foo: { 'classes/Foo.cls': 'foo' } });

        await retrieveComponentFiles(org, type, '60.0', [{ name: 'Foo' }]);
        await retrieveComponentFiles(org, type, '60.0', [{ name: 'Foo' }]);

        expect(retrieveFiles).toHaveBeenCalledTimes(2);
    });

    it('hands back an empty component the org had nothing of', async () => {
        const org = newOrg();
        mockRetrieve({});

        const { files } = await retrieveComponentFiles(
            org,
            getMetadataType('ApexClass'),
            '60.0',
            [at('Gone')]
        );

        expect(files.get('Gone').size).toBe(0);
    });

    it('reads custom settings one by one through REST, every time', async () => {
        const org = newOrg();
        const type = getMetadataType('CustomSettings');
        readCustomSettingFile.mockImplementation((session, apiVersion, name) =>
            Promise.resolve({
                path: 'customSettings/' + name + '.setting',
                file: text(name)
            })
        );

        const { files } = await retrieveComponentFiles(org, type, '60.0', [
            { name: 'A__c' },
            { name: 'B__c' }
        ]);
        await retrieveComponentFiles(org, type, '60.0', [{ name: 'A__c' }]);

        expect(readCustomSettingFile).toHaveBeenCalledTimes(3);
        expect(files.get('B__c').get('customSettings/B__c.setting')).toEqual(
            text('B__c')
        );
        expect(retrieveFiles).not.toHaveBeenCalled();
    });
});

describe('compareComponents', () => {
    const LEFT_ORG = newOrg();
    const RIGHT_ORG = newOrg();

    function mockOrgs(filesByOrg) {
        retrieveFiles.mockImplementation((session, apiVersion, [{ members }]) =>
            Promise.resolve({
                files: new Map(
                    Object.entries(filesByOrg[session.instanceUrl] || {})
                        .filter(([path]) =>
                            members.includes(componentOfPath(path))
                        )
                        .map(([path, content]) => [path, text(content)])
                ),
                messages: []
            })
        );
    }

    it('compares each component and gives it a status', async () => {
        mockOrgs({
            [LEFT_ORG.instanceUrl]: {
                'classes/Same.cls': 'same',
                'classes/Changed.cls': 'left',
                'classes/Lonely.cls': 'only left'
            },
            [RIGHT_ORG.instanceUrl]: {
                'classes/Same.cls': 'same',
                'classes/Changed.cls': 'right',
                'classes/Newcomer.cls': 'only right'
            }
        });

        const result = await compareComponents(
            LEFT_ORG,
            RIGHT_ORG,
            getMetadataType('ApexTrigger'),
            '60.0',
            [
                { name: 'Same', presence: 'both' },
                { name: 'Changed', presence: 'both' },
                { name: 'Lonely', presence: 'left' },
                { name: 'Newcomer', presence: 'right' },
                { name: 'Ghost', presence: 'both' }
            ]
        );

        expect(
            [...result.components].map(([name, { status }]) => [name, status])
        ).toEqual([
            ['Same', IDENTICAL],
            ['Changed', DIFFERENT],
            ['Lonely', LEFT_ONLY],
            ['Newcomer', RIGHT_ONLY],
            ['Ghost', UNAVAILABLE]
        ]);
        expect(result.components.get('Changed').entries[0]).toMatchObject({
            path: 'classes/Changed.cls',
            status: DIFFERENT
        });
        expect(result.left).toEqual({ problems: [] });
    });

    it('asks each org only for the components it holds', async () => {
        mockOrgs({});

        await compareComponents(
            LEFT_ORG,
            RIGHT_ORG,
            getMetadataType('ApexPage'),
            '60.0',
            [
                { name: 'Both', presence: 'both' },
                { name: 'LeftOnly', presence: 'left' }
            ]
        );

        expect(
            retrieveFiles.mock.calls.map(([session, , [{ members }]]) => [
                session.instanceUrl,
                members
            ])
        ).toEqual([
            [LEFT_ORG.instanceUrl, ['Both', 'LeftOnly']],
            [RIGHT_ORG.instanceUrl, ['Both']]
        ]);
    });

    it('reports the org that failed and compares nothing', async () => {
        retrieveFiles.mockImplementation((session) =>
            session.instanceUrl === RIGHT_ORG.instanceUrl
                ? Promise.reject(new Error('INVALID_SESSION_ID'))
                : Promise.resolve({ files: new Map(), messages: [] })
        );

        const result = await compareComponents(
            LEFT_ORG,
            RIGHT_ORG,
            getMetadataType('ApexComponent'),
            '60.0',
            [{ name: 'Header', presence: 'both' }]
        );

        expect(result.right).toEqual({ error: 'INVALID_SESSION_ID' });
        expect(result.components.size).toBe(0);
    });

    it('tells which org a status belongs to', async () => {
        mockOrgs({});
        const onStatus = jest.fn();

        await compareComponents(
            LEFT_ORG,
            RIGHT_ORG,
            getMetadataType('FlexiPage'),
            '60.0',
            [{ name: 'Home', presence: 'both' }],
            { onStatus }
        );
        retrieveFiles.mock.calls[0][3].onStatus('InProgress');

        expect(onStatus).toHaveBeenCalledWith('left', 'InProgress');
    });
});
