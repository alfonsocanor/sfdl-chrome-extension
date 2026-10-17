import {
    customSettingDocument,
    retrieveCustomSettingFiles,
    listCustomSettings,
    readCustomSettingFile
} from 'sfdl/customSettings';

const ACME = {
    instanceUrl: 'https://acme.my.salesforce.com',
    authToken: 'sid'
};

const INTEGRATION_DESCRIBE = {
    name: 'Integration__c',
    label: 'Integration',
    fields: [
        { name: 'Id', custom: false, type: 'id' },
        { name: 'SetupOwnerId', custom: false, type: 'reference' },
        {
            name: 'Timeout__c',
            custom: true,
            type: 'double',
            precision: 18,
            scale: 0
        },
        { name: 'Endpoint__c', custom: true, type: 'string', length: 255 },
        { name: 'Enabled__c', custom: true, type: 'boolean' }
    ]
};

const COUNTRIES_DESCRIBE = {
    name: 'Country_Codes__c',
    label: 'Country Codes',
    fields: [
        { name: 'Name', custom: false, type: 'string', length: 38 },
        { name: 'Code__c', custom: true, type: 'string', length: 3 }
    ]
};

function jsonResponse(body, status = 200) {
    return Promise.resolve({
        status,
        statusText: 'OK',
        json: () => Promise.resolve(body)
    });
}

describe('customSettingDocument', () => {
    it('writes the definition and every value of a hierarchy setting', () => {
        const records = [
            {
                SetupOwnerId: '005xx0000012345',
                SetupOwner: { Name: 'Jane Roe' },
                Endpoint__c: 'https://debug.example.com',
                Timeout__c: 90,
                Enabled__c: true
            },
            {
                SetupOwnerId: '00exx000000ABCD',
                SetupOwner: { Name: 'System Administrator' },
                Endpoint__c: null,
                Timeout__c: 60,
                Enabled__c: true
            },
            {
                SetupOwnerId: '00Dxx0000001gPF',
                SetupOwner: { Name: 'Acme' },
                Endpoint__c: 'https://api.example.com',
                Timeout__c: 30,
                Enabled__c: false
            }
        ];

        expect(customSettingDocument(INTEGRATION_DESCRIBE, records)).toBe(
            [
                'Custom Setting: Integration__c',
                'Label: Integration',
                'Type: Hierarchy',
                '',
                'Fields:',
                '  Enabled__c: Checkbox',
                '  Endpoint__c: Text(255)',
                '  Timeout__c: Number(18, 0)',
                '',
                'Values:',
                '  Org Default:',
                '    Enabled__c: false',
                '    Endpoint__c: https://api.example.com',
                '    Timeout__c: 30',
                '  Profile: System Administrator:',
                '    Enabled__c: true',
                '    Endpoint__c: ',
                '    Timeout__c: 60',
                '  User: Jane Roe:',
                '    Enabled__c: true',
                '    Endpoint__c: https://debug.example.com',
                '    Timeout__c: 90',
                ''
            ].join('\n')
        );
    });

    it('writes the records of a list setting by name', () => {
        const document = customSettingDocument(COUNTRIES_DESCRIBE, [
            { Name: 'Spain', Code__c: 'ESP' },
            { Name: 'France', Code__c: 'FRA' }
        ]);

        expect(document).toContain('Type: List');
        expect(document).toContain(
            [
                '  Record: France:',
                '    Code__c: FRA',
                '  Record: Spain:',
                '    Code__c: ESP'
            ].join('\n')
        );
    });

    it('keeps a value on several lines on one line', () => {
        const document = customSettingDocument(COUNTRIES_DESCRIBE, [
            { Name: 'Spain', Code__c: 'line one\nline two' }
        ]);

        expect(document).toContain('    Code__c: "line one\\nline two"');
    });

    it('says when there are no values', () => {
        expect(customSettingDocument(COUNTRIES_DESCRIBE, [])).toContain(
            'Values:\n  None\n'
        );
    });

    it('still writes the definition when the values cannot be read', () => {
        const document = customSettingDocument(
            COUNTRIES_DESCRIBE,
            [],
            'Insufficient access'
        );

        expect(document).toContain('  Code__c: Text(3)');
        expect(document).toContain(
            '  The values could not be read: Insufficient access'
        );
    });
});

describe('retrieveCustomSettingFiles', () => {
    function mockOrg({ queryFails = false } = {}) {
        global.fetch = jest.fn((url) => {
            if (url.endsWith('/sobjects/')) {
                return jsonResponse({
                    sobjects: [
                        { name: 'Integration__c', customSetting: true },
                        { name: 'Account', customSetting: false },
                        { name: 'pkg__Config__c', customSetting: true },
                        { name: 'Country_Codes__c', customSetting: true }
                    ]
                });
            }
            if (url.includes('/Integration__c/describe/')) {
                return jsonResponse(INTEGRATION_DESCRIBE);
            }
            if (url.includes('/Country_Codes__c/describe/')) {
                return jsonResponse(COUNTRIES_DESCRIBE);
            }
            if (url.includes('/pkg__Config__c/describe/')) {
                return jsonResponse({
                    ...COUNTRIES_DESCRIBE,
                    name: 'pkg__Config__c'
                });
            }
            if (url.includes('/query/')) {
                return queryFails
                    ? jsonResponse(
                          [
                              {
                                  message: 'Insufficient access',
                                  errorCode: 'INSUFFICIENT_ACCESS'
                              }
                          ],
                          403
                      )
                    : jsonResponse({ done: true, records: [] });
            }
            return jsonResponse({}, 404);
        });
    }

    const queries = () =>
        fetch.mock.calls
            .map(([url]) => url)
            .filter((url) => url.includes('/query/'))
            .map((url) => decodeURIComponent(url.split('?q=')[1]));

    it('reads one custom setting by name', async () => {
        mockOrg();

        const { path, file } = await readCustomSettingFile(
            ACME,
            '60.0',
            'Integration__c'
        );

        expect(path).toBe('customSettings/Integration__c.setting');
        expect(file.isBinary).toBe(false);
        expect(file.content).toContain('Custom Setting: Integration__c');
        expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('lists the names of the custom settings in one call', async () => {
        mockOrg();

        await expect(listCustomSettings(ACME, '60.0')).resolves.toEqual([
            { name: 'Country_Codes__c' },
            { name: 'Integration__c' }
        ]);
        expect(fetch).toHaveBeenCalledTimes(1);
        await expect(
            listCustomSettings(ACME, '60.0', { includeManaged: true })
        ).resolves.toContainEqual({ name: 'pkg__Config__c' });
    });

    it('writes a file per custom setting of the org, managed ones left out', async () => {
        mockOrg();
        const onStatus = jest.fn();

        const files = await retrieveCustomSettingFiles(ACME, '60.0', {
            onStatus
        });

        expect([...files.keys()]).toEqual([
            'customSettings/Country_Codes__c.setting',
            'customSettings/Integration__c.setting'
        ]);
        expect(files.get('customSettings/Integration__c.setting')).toEqual({
            content: expect.stringContaining('Custom Setting: Integration__c'),
            isBinary: false
        });
        expect(onStatus.mock.calls.map(([status]) => status)).toEqual([
            'Listing the custom settings',
            'Read 1 of 2 custom settings',
            'Read 2 of 2 custom settings'
        ]);
    });

    it('reads the owner of hierarchy values and the custom fields', async () => {
        mockOrg();

        await retrieveCustomSettingFiles(ACME, '60.0');

        expect(queries()).toEqual(
            expect.arrayContaining([
                'SELECT Name, SetupOwnerId, SetupOwner.Name, Timeout__c, Endpoint__c, Enabled__c FROM Integration__c',
                'SELECT Name, Code__c FROM Country_Codes__c'
            ])
        );
    });

    it('includes the settings of managed packages when asked to', async () => {
        mockOrg();

        const files = await retrieveCustomSettingFiles(ACME, '60.0', {
            includeManaged: true
        });

        expect([...files.keys()]).toContain(
            'customSettings/pkg__Config__c.setting'
        );
    });

    it('compares the definitions of settings whose values cannot be read', async () => {
        mockOrg({ queryFails: true });

        const files = await retrieveCustomSettingFiles(ACME, '60.0');

        expect(
            files.get('customSettings/Country_Codes__c.setting').content
        ).toContain('The values could not be read: Insufficient access');
    });
});
