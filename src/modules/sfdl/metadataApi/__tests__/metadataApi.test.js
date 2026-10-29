import JSZip from 'jszip';
import {
    metadataCall,
    listMetadata,
    retrieve,
    checkRetrieveStatus,
    unzipFiles,
    retrieveFiles,
    readMetadata,
    updateMetadata,
    childElements,
    childText
} from 'sfdl/metadataApi';

const ACME = {
    instanceUrl: 'https://acme.my.salesforce.com',
    authToken: 'sid&acme'
};

function soapResponse(body, status = 200) {
    return {
        status,
        text: () =>
            Promise.resolve(
                '<?xml version="1.0" encoding="UTF-8"?>' +
                    '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns="http://soap.sforce.com/2006/04/metadata">' +
                    '<soapenv:Body>' +
                    body +
                    '</soapenv:Body></soapenv:Envelope>'
            )
    };
}

function soapFault(faultString, faultCode = 'sf:INVALID_SESSION_ID') {
    return soapResponse(
        '<soapenv:Fault><faultcode>' +
            faultCode +
            '</faultcode><faultstring>' +
            faultString +
            '</faultstring></soapenv:Fault>',
        500
    );
}

function retrieveStatus({
    done,
    status,
    zipFile = '',
    messages = '',
    errorMessage = ''
}) {
    return soapResponse(
        '<checkRetrieveStatusResponse><result>' +
            '<done>' +
            done +
            '</done>' +
            (errorMessage
                ? '<errorMessage>' + errorMessage + '</errorMessage>'
                : '') +
            '<id>09S1</id>' +
            messages +
            '<status>' +
            status +
            '</status>' +
            '<success>' +
            (status !== 'Failed') +
            '</success>' +
            (zipFile ? '<zipFile>' + zipFile + '</zipFile>' : '') +
            '</result></checkRetrieveStatusResponse>'
    );
}

const requestBody = (call = 0) => fetch.mock.calls[call][1].body;

async function zipOf(files) {
    const zip = new JSZip();
    Object.entries(files).forEach(([path, content]) => zip.file(path, content));
    return zip.generateAsync({ type: 'base64' });
}

describe('metadataApi', () => {
    describe('metadataCall', () => {
        it('posts a SOAP envelope carrying the session id', async () => {
            global.fetch = jest.fn(() =>
                Promise.resolve(soapResponse('<ok/>'))
            );

            await metadataCall(ACME, '60.0', '<met:describeMetadata/>');

            const [url, request] = fetch.mock.calls[0];
            expect(url).toBe(
                'https://acme.my.salesforce.com/services/Soap/m/60.0'
            );
            expect(request.method).toBe('POST');
            expect(request.headers['Content-Type']).toBe(
                'text/xml; charset=UTF-8'
            );
            expect(request.headers.SOAPAction).toBe('""');
            expect(request.body).toContain(
                '<met:sessionId>sid&amp;acme</met:sessionId>'
            );
            expect(request.body).toContain(
                '<soapenv:Body><met:describeMetadata/></soapenv:Body>'
            );
        });

        it('turns a SOAP fault into an error carrying its code', async () => {
            global.fetch = jest.fn(() =>
                Promise.resolve(
                    soapFault(
                        'INVALID_SESSION_ID: Invalid Session ID found in SessionHeader'
                    )
                )
            );

            await expect(
                metadataCall(ACME, '60.0', '<x/>')
            ).rejects.toMatchObject({
                name: 'SalesforceError',
                status: 500,
                errorCode: 'INVALID_SESSION_ID',
                message:
                    'INVALID_SESSION_ID: Invalid Session ID found in SessionHeader'
            });
        });

        it('reports an error status without a fault', async () => {
            global.fetch = jest.fn(() =>
                Promise.resolve({
                    status: 503,
                    statusText: 'Service Unavailable',
                    text: () => Promise.resolve('<html/>')
                })
            );

            await expect(metadataCall(ACME, '60.0', '<x/>')).rejects.toThrow(
                'The Metadata API answered 503 Service Unavailable'
            );
        });

        it('reports an org it cannot reach', async () => {
            global.fetch = jest.fn(() =>
                Promise.reject(new Error('Failed to fetch'))
            );

            await expect(metadataCall(ACME, '60.0', '<x/>')).rejects.toThrow(
                'Could not reach https://acme.my.salesforce.com: Failed to fetch'
            );
        });
    });

    describe('listMetadata', () => {
        it('lists the components of every query', async () => {
            global.fetch = jest.fn(() =>
                Promise.resolve(
                    soapResponse(
                        '<listMetadataResponse>' +
                            '<result><fullName>Account</fullName><type>CustomObject</type><fileName>objects/Account.object</fileName><lastModifiedByName>Jane Roe</lastModifiedByName><lastModifiedDate>2026-10-12T09:30:00.000Z</lastModifiedDate><manageableState>unmanaged</manageableState></result>' +
                            '<result><fullName>pkg__Thing__c</fullName><namespacePrefix>pkg</namespacePrefix><type>CustomObject</type><fileName>objects/pkg__Thing__c.object</fileName><manageableState>installed</manageableState></result>' +
                            '</listMetadataResponse>'
                    )
                )
            );

            const components = await listMetadata(ACME, '60.0', [
                { type: 'CustomObject' }
            ]);

            expect(components).toEqual([
                {
                    fullName: 'Account',
                    type: 'CustomObject',
                    namespacePrefix: '',
                    manageableState: 'unmanaged',
                    fileName: 'objects/Account.object',
                    lastModifiedDate: '2026-10-12T09:30:00.000Z',
                    lastModifiedByName: 'Jane Roe'
                },
                {
                    fullName: 'pkg__Thing__c',
                    type: 'CustomObject',
                    namespacePrefix: 'pkg',
                    manageableState: 'installed',
                    fileName: 'objects/pkg__Thing__c.object',
                    lastModifiedDate: undefined,
                    lastModifiedByName: undefined
                }
            ]);
            expect(requestBody()).toContain(
                '<met:listMetadata><met:queries><met:type>CustomObject</met:type></met:queries><met:asOfVersion>60.0</met:asOfVersion></met:listMetadata>'
            );
        });

        it('sends three queries per call at most', async () => {
            global.fetch = jest.fn(() =>
                Promise.resolve(soapResponse('<listMetadataResponse/>'))
            );

            await listMetadata(ACME, '60.0', [
                { type: 'A' },
                { type: 'B' },
                { type: 'C' },
                { type: 'EmailTemplate', folder: 'unfiled$public' }
            ]);

            expect(fetch).toHaveBeenCalledTimes(2);
            expect(requestBody(1)).toContain(
                '<met:queries><met:folder>unfiled$public</met:folder><met:type>EmailTemplate</met:type></met:queries>'
            );
        });
    });

    describe('retrieve', () => {
        it('asks for a single package of the types and their members', async () => {
            global.fetch = jest.fn(() =>
                Promise.resolve(
                    soapResponse(
                        '<retrieveResponse><result><done>false</done><id>09S1</id><state>Queued</state></result></retrieveResponse>'
                    )
                )
            );

            await expect(
                retrieve(ACME, '60.0', [
                    { name: 'ApexClass', members: ['*'] },
                    { name: 'CustomObject', members: ['Account', 'Contact'] }
                ])
            ).resolves.toBe('09S1');
            expect(requestBody()).toContain(
                '<met:retrieveRequest><met:apiVersion>60.0</met:apiVersion><met:singlePackage>true</met:singlePackage>' +
                    '<met:unpackaged>' +
                    '<met:types><met:members>*</met:members><met:name>ApexClass</met:name></met:types>' +
                    '<met:types><met:members>Account</met:members><met:members>Contact</met:members><met:name>CustomObject</met:name></met:types>' +
                    '<met:version>60.0</met:version></met:unpackaged></met:retrieveRequest>'
            );
        });
    });

    describe('checkRetrieveStatus', () => {
        it('reads the status, the problems and the zip', async () => {
            global.fetch = jest.fn(() =>
                Promise.resolve(
                    retrieveStatus({
                        done: true,
                        status: 'Succeeded',
                        zipFile: 'UEsDBA==',
                        messages:
                            '<messages><fileName>unpackaged/package.xml</fileName><problem>Entity of type ApexClass named Gone cannot be found</problem></messages>'
                    })
                )
            );

            await expect(
                checkRetrieveStatus(ACME, '60.0', '09S1')
            ).resolves.toEqual({
                done: true,
                status: 'Succeeded',
                success: true,
                errorMessage: undefined,
                zipFile: 'UEsDBA==',
                messages: [
                    {
                        fileName: 'unpackaged/package.xml',
                        problem:
                            'Entity of type ApexClass named Gone cannot be found'
                    }
                ]
            });
            expect(requestBody()).toContain(
                '<met:asyncProcessId>09S1</met:asyncProcessId><met:includeZip>true</met:includeZip>'
            );
        });
    });

    describe('unzipFiles', () => {
        it('reads every file but package.xml as text', async () => {
            const zipFile = await zipOf({
                'package.xml': '<Package/>',
                'classes/Foo.cls': 'public class Foo {}',
                'classes/Foo.cls-meta.xml': '<ApexClass/>'
            });

            const files = await unzipFiles(zipFile);

            expect([...files.keys()].sort()).toEqual([
                'classes/Foo.cls',
                'classes/Foo.cls-meta.xml'
            ]);
            expect(files.get('classes/Foo.cls')).toEqual({
                content: 'public class Foo {}',
                isBinary: false
            });
        });

        it('keeps binary files as base64', async () => {
            const zip = new JSZip();
            zip.file(
                'staticresources/logo.resource',
                new Uint8Array([137, 80, 78, 71, 0, 1])
            );

            const files = await unzipFiles(
                await zip.generateAsync({ type: 'base64' })
            );

            expect(files.get('staticresources/logo.resource')).toEqual({
                content: 'iVBORwAB',
                isBinary: true
            });
        });
    });

    describe('retrieveFiles', () => {
        function mockRetrieve(statuses) {
            const responses = [
                soapResponse(
                    '<retrieveResponse><result><id>09S1</id></result></retrieveResponse>'
                ),
                ...statuses
            ];
            global.fetch = jest.fn(() => Promise.resolve(responses.shift()));
        }

        it('waits for the org to package the files and unzips them', async () => {
            const zipFile = await zipOf({
                'classes/Foo.cls': 'public class Foo {}'
            });
            mockRetrieve([
                retrieveStatus({ done: false, status: 'Pending' }),
                retrieveStatus({ done: false, status: 'InProgress' }),
                retrieveStatus({ done: true, status: 'Succeeded', zipFile })
            ]);
            const onStatus = jest.fn();

            const { files, messages } = await retrieveFiles(
                ACME,
                '60.0',
                [{ name: 'ApexClass', members: ['*'] }],
                { onStatus, pollInterval: 0 }
            );

            expect(files.get('classes/Foo.cls').content).toBe(
                'public class Foo {}'
            );
            expect(messages).toEqual([]);
            expect(onStatus.mock.calls.map(([status]) => status)).toEqual([
                'Pending',
                'Pending',
                'InProgress',
                'Succeeded'
            ]);
        });

        it('asks for the status less and less often', async () => {
            const zipFile = await zipOf({ 'classes/Foo.cls': 'x' });
            mockRetrieve([
                retrieveStatus({ done: false, status: 'Pending' }),
                retrieveStatus({ done: false, status: 'InProgress' }),
                retrieveStatus({ done: false, status: 'InProgress' }),
                retrieveStatus({ done: true, status: 'Succeeded', zipFile })
            ]);
            const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

            await retrieveFiles(
                ACME,
                '60.0',
                [{ name: 'ApexClass', members: ['*'] }],
                {
                    pollInterval: 4,
                    maxPollInterval: 8
                }
            );

            expect(
                setTimeoutSpy.mock.calls
                    .map(([, delay]) => delay)
                    .filter((delay) => delay >= 4)
            ).toEqual([4, 6, 8, 8]);
            setTimeoutSpy.mockRestore();
        });

        it('fails with the message of the org', async () => {
            mockRetrieve([
                retrieveStatus({
                    done: true,
                    status: 'Failed',
                    errorMessage: 'INVALID_CROSS_REFERENCE_KEY: no such type'
                })
            ]);

            await expect(
                retrieveFiles(
                    ACME,
                    '60.0',
                    [{ name: 'Nope', members: ['*'] }],
                    {
                        pollInterval: 0
                    }
                )
            ).rejects.toThrow('INVALID_CROSS_REFERENCE_KEY: no such type');
        });

        it('gives up when the org takes too long', async () => {
            mockRetrieve([
                retrieveStatus({ done: false, status: 'InProgress' }),
                retrieveStatus({ done: false, status: 'InProgress' })
            ]);

            await expect(
                retrieveFiles(
                    ACME,
                    '60.0',
                    [{ name: 'ApexClass', members: ['*'] }],
                    {
                        pollInterval: 5,
                        timeout: 1
                    }
                )
            ).rejects.toThrow('The org took too long to retrieve the metadata');
        });

        it('stops when it is cancelled', async () => {
            mockRetrieve([
                retrieveStatus({ done: false, status: 'InProgress' })
            ]);
            const controller = new AbortController();

            const retrieving = retrieveFiles(
                ACME,
                '60.0',
                [{ name: 'ApexClass', members: ['*'] }],
                { pollInterval: 1000, signal: controller.signal }
            );
            await Promise.resolve();
            await Promise.resolve();
            controller.abort();

            await expect(retrieving).rejects.toMatchObject({
                name: 'AbortError'
            });
        });
    });
});

describe('metadataApi reading and saving one component', () => {
    it('readMetadata asks for the components by name and hands their records', async () => {
        global.fetch = jest.fn(() => Promise.resolve(soapResponse(
            '<readMetadataResponse><result><records xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:type="RealTimeEventSettings">' +
            '<fullName>RealTimeEvent</fullName>' +
            '<realTimeEvents><entityName>LoginEventStream</entityName><isEnabled>false</isEnabled></realTimeEvents>' +
            '</records></result></readMetadataResponse>'
        )));

        const [record] = await readMetadata(ACME, '60.0', 'RealTimeEventSettings', ['RealTimeEvent']);

        const body = fetch.mock.calls[0][1].body;
        expect(fetch.mock.calls[0][0]).toBe('https://acme.my.salesforce.com/services/Soap/m/60.0');
        expect(body).toContain('<met:readMetadata><met:type>RealTimeEventSettings</met:type><met:fullNames>RealTimeEvent</met:fullNames></met:readMetadata>');
        expect(childText(record, 'fullName')).toBe('RealTimeEvent');
        expect(childElements(record, 'realTimeEvents').map((setting) => childText(setting, 'entityName'))).toEqual(['LoginEventStream']);
    });

    it('updateMetadata sends the component with its type and goes through when saved', async () => {
        global.fetch = jest.fn(() => Promise.resolve(soapResponse(
            '<updateMetadataResponse><result><fullName>RealTimeEvent</fullName><success>true</success></result></updateMetadataResponse>'
        )));

        await updateMetadata(ACME, '60.0', 'RealTimeEventSettings', '<met:fullName>RealTimeEvent</met:fullName>');

        expect(fetch.mock.calls[0][1].body).toContain(
            '<met:updateMetadata><met:metadata xsi:type="met:RealTimeEventSettings" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><met:fullName>RealTimeEvent</met:fullName></met:metadata></met:updateMetadata>'
        );
    });

    it('updateMetadata throws what the api said when it did not save', async () => {
        global.fetch = jest.fn(() => Promise.resolve(soapResponse(
            '<updateMetadataResponse><result><fullName>RealTimeEvent</fullName><success>false</success>' +
            '<errors><message>You do not have the license</message><statusCode>FIELD_INTEGRITY_EXCEPTION</statusCode></errors>' +
            '</result></updateMetadataResponse>'
        )));

        await expect(updateMetadata(ACME, '60.0', 'RealTimeEventSettings', '')).rejects.toMatchObject({
            message: 'You do not have the license',
            errorCode: 'FIELD_INTEGRITY_EXCEPTION'
        });
    });
});
