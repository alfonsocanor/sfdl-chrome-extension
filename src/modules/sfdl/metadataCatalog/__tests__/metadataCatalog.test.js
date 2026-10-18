import {
    METADATA_TYPES,
    getMetadataType,
    metadataTypeOptions,
    listMetadataComponents,
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

    describe('listMetadataComponents', () => {
        const component = (fullName, extra = {}) => ({
            fullName,
            namespacePrefix: '',
            lastModifiedDate: '2026-10-12T09:30:00.000Z',
            lastModifiedByName: 'Jane Roe',
            ...extra
        });

        it('lists the names with their last change, by name, in one call', async () => {
            listMetadata.mockResolvedValue([
                component('Utils'),
                component('AccountService', { lastModifiedByName: 'John Doe' })
            ]);

            await expect(
                listMetadataComponents(
                    getMetadataType('ApexClass'),
                    ACME,
                    '60.0'
                )
            ).resolves.toEqual([
                {
                    name: 'AccountService',
                    lastModifiedDate: '2026-10-12T09:30:00.000Z',
                    lastModifiedByName: 'John Doe'
                },
                {
                    name: 'Utils',
                    lastModifiedDate: '2026-10-12T09:30:00.000Z',
                    lastModifiedByName: 'Jane Roe'
                }
            ]);
            expect(listMetadata).toHaveBeenCalledTimes(1);
            expect(listMetadata).toHaveBeenCalledWith(ACME, '60.0', [
                { type: 'ApexClass' }
            ]);
        });

        it('leaves the components of managed packages out', async () => {
            listMetadata.mockResolvedValue([
                component('Utils'),
                component('pkg__Helper', { namespacePrefix: 'pkg' })
            ]);

            const components = await listMetadataComponents(
                getMetadataType('ApexClass'),
                ACME,
                '60.0'
            );

            expect(components.map(({ name }) => name)).toEqual(['Utils']);
        });

        it('tells the standard objects from the custom ones', async () => {
            listMetadata.mockResolvedValue([
                component('Account'),
                component('Invoice__c'),
                component('Contact'),
                component('Rate__mdt')
            ]);

            const standard = await listMetadataComponents(
                getMetadataType('StandardObjects'),
                ACME,
                '60.0'
            );
            const custom = await listMetadataComponents(
                getMetadataType('CustomObjects'),
                ACME,
                '60.0'
            );

            expect(standard.map(({ name }) => name)).toEqual([
                'Account',
                'Contact'
            ]);
            expect(custom.map(({ name }) => name)).toEqual([
                'Invoice__c',
                'Rate__mdt'
            ]);
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
