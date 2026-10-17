import {
    compareFileSets,
    countByStatus,
    retrieveOrgFiles,
    listOrgComponents,
    DIFFERENT,
    LEFT_ONLY,
    RIGHT_ONLY,
    IDENTICAL
} from 'sfdl/orgCompare';
import { getMetadataType } from 'sfdl/metadataCatalog';
import { retrieveFiles, listMetadata } from 'sfdl/metadataApi';
import {
    retrieveCustomSettingFiles,
    listCustomSettings
} from 'sfdl/customSettings';

jest.mock('sfdl/metadataApi', () => ({
    retrieveFiles: jest.fn(),
    listMetadata: jest.fn()
}));
jest.mock('sfdl/customSettings', () => ({
    retrieveCustomSettingFiles: jest.fn(),
    listCustomSettings: jest.fn()
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

    it('counts the entries of each status', () => {
        const entries = compareFileSets(
            files({ a: text('1'), b: text('2'), c: text('3') }),
            files({ a: text('1'), b: text('x'), d: text('4') })
        );

        expect(countByStatus(entries)).toEqual({
            all: 4,
            [DIFFERENT]: 1,
            [LEFT_ONLY]: 1,
            [RIGHT_ONLY]: 1,
            [IDENTICAL]: 1
        });
    });
});

describe('retrieveOrgFiles', () => {
    const OBJECT = `<?xml version="1.0" encoding="UTF-8"?>
<CustomObject xmlns="http://soap.sforce.com/2006/04/metadata">
    <fields>
        <fullName>Rating__c</fullName>
    </fields>
</CustomObject>
`;

    beforeEach(() => {
        retrieveFiles.mockResolvedValue({
            files: files({ 'objects/Invoice__c.object': text(OBJECT) }),
            messages: [
                {
                    fileName: 'package.xml',
                    problem:
                        'Entity of type CustomObject named Gone__c cannot be found'
                },
                { fileName: 'objects/Invoice__c.object', problem: undefined }
            ]
        });
    });

    it('retrieves the type and splits its files', async () => {
        const org = newOrg();
        const onStatus = jest.fn();

        const result = await retrieveOrgFiles(
            org,
            getMetadataType('CustomObjects'),
            '60.0',
            {
                onStatus
            }
        );

        expect(retrieveFiles).toHaveBeenCalledWith(
            org,
            '60.0',
            [{ name: 'CustomObject', members: ['*'] }],
            { onStatus }
        );
        expect([...result.files.keys()]).toEqual([
            'objects/Invoice__c/fields/Rating__c.field'
        ]);
        expect(result.problems).toEqual([
            'Entity of type CustomObject named Gone__c cannot be found'
        ]);
        expect(onStatus).toHaveBeenCalledWith('Listing the components');
    });

    it('reads custom settings through REST', async () => {
        const org = newOrg();
        const settings = files({
            'customSettings/A__c.setting': text('Custom Setting: A__c')
        });
        retrieveCustomSettingFiles.mockResolvedValue(settings);

        const result = await retrieveOrgFiles(
            org,
            getMetadataType('CustomSettings'),
            '60.0',
            {
                includeManaged: true
            }
        );

        expect(result).toEqual({ files: settings, problems: [] });
        expect(retrieveCustomSettingFiles).toHaveBeenCalledWith(org, '60.0', {
            includeManaged: true,
            onStatus: expect.any(Function)
        });
        expect(retrieveFiles).not.toHaveBeenCalled();
    });

    it('retrieves nothing when the org lists no component', async () => {
        listMetadata.mockResolvedValue([]);

        const result = await retrieveOrgFiles(
            newOrg(),
            getMetadataType('StandardObjects'),
            '60.0'
        );

        expect(result.files.size).toBe(0);
        expect(retrieveFiles).not.toHaveBeenCalled();
    });

    it('retrieves an org and a type once per session', async () => {
        const org = newOrg();
        const type = getMetadataType('ApexClass');
        const onStatus = jest.fn();

        await retrieveOrgFiles(org, type, '60.0');
        await retrieveOrgFiles(org, type, '60.0', { onStatus });

        expect(retrieveFiles).toHaveBeenCalledTimes(1);
        expect(onStatus).toHaveBeenCalledWith('Already retrieved');
    });

    it('keeps the managed and the unmanaged retrieves apart', async () => {
        const org = newOrg();
        const type = getMetadataType('ApexClass');
        listMetadata.mockResolvedValue([{ fullName: 'pkg__Helper' }]);

        await retrieveOrgFiles(org, type, '60.0');
        await retrieveOrgFiles(org, type, '60.0', { includeManaged: true });

        expect(retrieveFiles).toHaveBeenCalledTimes(2);
    });

    it('retrieves again on refresh', async () => {
        const org = newOrg();
        const type = getMetadataType('ApexClass');

        await retrieveOrgFiles(org, type, '60.0');
        await retrieveOrgFiles(org, type, '60.0', { refresh: true });

        expect(retrieveFiles).toHaveBeenCalledTimes(2);
    });

    it('forgets a retrieve that failed so it can be tried again', async () => {
        const org = newOrg();
        const type = getMetadataType('ApexClass');
        retrieveFiles.mockRejectedValueOnce(new Error('INVALID_SESSION_ID'));

        await expect(retrieveOrgFiles(org, type, '60.0')).rejects.toThrow(
            'INVALID_SESSION_ID'
        );
        await retrieveOrgFiles(org, type, '60.0');

        expect(retrieveFiles).toHaveBeenCalledTimes(2);
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
            listOrgComponents(org, getMetadataType('CustomSettings'), '60.0', {
                includeManaged: true
            })
        ).resolves.toEqual([{ name: 'A__c' }]);
        expect(listCustomSettings).toHaveBeenCalledWith(org, '60.0', {
            includeManaged: true
        });
        expect(listMetadata).not.toHaveBeenCalled();
    });

    it('lists an org and a type once until refreshed', async () => {
        const org = newOrg();
        const type = getMetadataType('ApexTrigger');
        listMetadata.mockResolvedValue([]);

        await listOrgComponents(org, type, '60.0');
        await listOrgComponents(org, type, '60.0');
        await listOrgComponents(org, type, '60.0', { refresh: true });

        expect(listMetadata).toHaveBeenCalledTimes(2);
    });

    it('forgets a listing that failed', async () => {
        const org = newOrg();
        const type = getMetadataType('ApexTrigger');
        listMetadata.mockRejectedValueOnce(new Error('INVALID_SESSION_ID'));
        listMetadata.mockResolvedValueOnce([]);

        await expect(listOrgComponents(org, type, '60.0')).rejects.toThrow(
            'INVALID_SESSION_ID'
        );
        await expect(listOrgComponents(org, type, '60.0')).resolves.toEqual([]);
    });
});
