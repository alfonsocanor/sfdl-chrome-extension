import {
    METADATA_TYPES,
    getMetadataType,
    metadataTypeOptions,
    retrieveRequestFor,
    languageForFile
} from 'sfdl/metadataCatalog';
import { listMetadata } from 'sfdl/metadataApi';

jest.mock('sfdl/metadataApi', () => ({ listMetadata: jest.fn() }));

const ACME = {
    instanceUrl: 'https://acme.my.salesforce.com',
    authToken: 'sid'
};

describe('metadataCatalog', () => {
    describe('types', () => {
        it('offers the types grouped for the picker', () => {
            const options = metadataTypeOptions();

            expect(options[0]).toEqual({
                label: 'Apex Classes',
                value: 'ApexClass',
                group: 'Code'
            });
            expect([...new Set(options.map(({ group }) => group))]).toEqual([
                'Code',
                'User interface',
                'Data model',
                'Automation',
                'Configuration'
            ]);
            expect(options.map(({ label }) => label)).toEqual(
                expect.arrayContaining([
                    'Visualforce Pages',
                    'Visualforce Components',
                    'Custom Settings',
                    'Custom Metadata Records'
                ])
            );
        });

        it('gives every type a key of its own', () => {
            const keys = METADATA_TYPES.map(({ key }) => key);

            expect(new Set(keys).size).toBe(keys.length);
        });

        it('reads custom settings through REST, their values are data', () => {
            expect(getMetadataType('CustomSettings').engine).toBe(
                'customSettings'
            );
            expect(getMetadataType('ApexClass').engine).toBe('metadata');
        });

        it('leaves out profiles and permission sets', () => {
            const metadataTypes = METADATA_TYPES.map(
                ({ metadataType }) => metadataType
            );

            expect(metadataTypes).not.toContain('Profile');
            expect(metadataTypes).not.toContain('PermissionSet');
        });
    });

    describe('retrieveRequestFor', () => {
        it('retrieves every component through the wildcard', async () => {
            await expect(
                retrieveRequestFor(getMetadataType('ApexClass'), ACME, '60.0')
            ).resolves.toEqual([{ name: 'ApexClass', members: ['*'] }]);
            expect(listMetadata).not.toHaveBeenCalled();
        });

        it('names every component the org lists to include managed packages', async () => {
            listMetadata.mockResolvedValue([
                { fullName: 'pkg__Helper' },
                { fullName: 'AccountService' }
            ]);

            await expect(
                retrieveRequestFor(getMetadataType('ApexClass'), ACME, '60.0', {
                    includeManaged: true
                })
            ).resolves.toEqual([
                {
                    name: 'ApexClass',
                    members: ['AccountService', 'pkg__Helper']
                }
            ]);
            expect(listMetadata).toHaveBeenCalledWith(ACME, '60.0', [
                { type: 'ApexClass' }
            ]);
        });

        it('names the standard objects, the wildcard only covers custom ones', async () => {
            listMetadata.mockResolvedValue([
                { fullName: 'Contact' },
                { fullName: 'Invoice__c' },
                { fullName: 'Account' },
                { fullName: 'pkg__Thing__c' }
            ]);

            await expect(
                retrieveRequestFor(
                    getMetadataType('StandardObjects'),
                    ACME,
                    '60.0'
                )
            ).resolves.toEqual([
                { name: 'CustomObject', members: ['Account', 'Contact'] }
            ]);
        });

        it('asks for nothing when the org lists no component', async () => {
            listMetadata.mockResolvedValue([]);

            await expect(
                retrieveRequestFor(getMetadataType('ApexClass'), ACME, '60.0', {
                    includeManaged: true
                })
            ).resolves.toEqual([]);
        });
    });

    describe('languageForFile', () => {
        it.each([
            ['classes/AccountService.cls', 'apex'],
            ['triggers/AccountTrigger.trigger', 'apex'],
            ['pages/Invoice.page', 'html'],
            ['components/Header.component', 'html'],
            ['lwc/invoiceList/invoiceList.html', 'html'],
            ['lwc/invoiceList/invoiceList.js', 'javascript'],
            ['lwc/invoiceList/invoiceList.css', 'css'],
            ['aura/Invoice/Invoice.cmp', 'html'],
            ['classes/AccountService.cls-meta.xml', 'xml'],
            ['customSettings/Integration__c.setting', 'yaml']
        ])('reads %s as %s', (path, language) => {
            expect(languageForFile(path)).toBe(language);
        });

        it('reads the metadata files named after their type as xml', () => {
            expect(
                languageForFile(
                    'objects/Account/fields/Rating__c.field',
                    '<?xml version="1.0"?><CustomField/>'
                )
            ).toBe('xml');
            expect(
                languageForFile('customSettings/Config__c', 'Fields\n')
            ).toBe('plaintext');
        });
    });
});
