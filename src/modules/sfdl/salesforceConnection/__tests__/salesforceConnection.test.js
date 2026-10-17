import {
    SalesforceError,
    salesforceRequest,
    queryAll,
    getApiVersions,
    getCommonApiVersion,
    describeGlobal,
    describeSObject,
    mapWithConcurrency
} from 'sfdl/salesforceConnection';

const ACME = {
    instanceUrl: 'https://acme.my.salesforce.com',
    authToken: 'sid-acme'
};
const GLOBEX = {
    instanceUrl: 'https://globex.my.salesforce.com',
    authToken: 'sid-globex'
};

function jsonResponse(body, status = 200) {
    return Promise.resolve({
        status,
        statusText: status === 200 ? 'OK' : 'Bad Request',
        json: () => Promise.resolve(body),
        text: () => Promise.resolve(JSON.stringify(body))
    });
}

describe('salesforceConnection', () => {
    describe('salesforceRequest', () => {
        it('calls the org of the session with its token', async () => {
            global.fetch = jest.fn(() => jsonResponse({ ok: true }));

            const result = await salesforceRequest(ACME, '/services/data/');

            expect(result).toEqual({ ok: true });
            expect(fetch).toHaveBeenCalledWith(
                'https://acme.my.salesforce.com/services/data/',
                expect.objectContaining({
                    method: 'GET',
                    headers: expect.objectContaining({
                        Authorization: 'Bearer sid-acme'
                    })
                })
            );
        });

        it('uses an absolute url as it is', async () => {
            global.fetch = jest.fn(() => jsonResponse({}));

            await salesforceRequest(ACME, 'https://elsewhere.salesforce.com/x');

            expect(fetch.mock.calls[0][0]).toBe(
                'https://elsewhere.salesforce.com/x'
            );
        });

        it('returns the body as text when asked to', async () => {
            global.fetch = jest.fn(() =>
                Promise.resolve({
                    status: 200,
                    text: () => Promise.resolve('log body')
                })
            );

            await expect(
                salesforceRequest(ACME, '/x', { responseType: 'text' })
            ).resolves.toBe('log body');
        });

        it('lets the caller override the headers', async () => {
            global.fetch = jest.fn(() => jsonResponse({}));

            await salesforceRequest(ACME, '/x', {
                method: 'POST',
                headers: { 'Content-Type': 'text/xml' }
            });

            expect(fetch.mock.calls[0][1].headers['Content-Type']).toBe(
                'text/xml'
            );
        });

        it('explains an expired session', async () => {
            global.fetch = jest.fn(() => jsonResponse({}, 401));

            await expect(salesforceRequest(ACME, '/x')).rejects.toMatchObject({
                name: 'SalesforceError',
                status: 401,
                errorCode: 'INVALID_SESSION_ID',
                message: expect.stringContaining('acme.my.salesforce.com')
            });
        });

        it('surfaces the message the api sent back', async () => {
            global.fetch = jest.fn(() =>
                jsonResponse(
                    [
                        {
                            message: 'unexpected token: FROM',
                            errorCode: 'MALFORMED_QUERY'
                        }
                    ],
                    400
                )
            );

            await expect(salesforceRequest(ACME, '/x')).rejects.toMatchObject({
                status: 400,
                errorCode: 'MALFORMED_QUERY',
                message: 'unexpected token: FROM'
            });
        });

        it('falls back to the status text when the error is not json', async () => {
            global.fetch = jest.fn(() =>
                Promise.resolve({
                    status: 500,
                    statusText: 'Server Error',
                    json: () => Promise.reject(new Error('not json'))
                })
            );

            await expect(salesforceRequest(ACME, '/x')).rejects.toThrow(
                'Server Error'
            );
        });

        it('reports an org it cannot reach', async () => {
            global.fetch = jest.fn(() =>
                Promise.reject(new Error('Failed to fetch'))
            );

            const error = await salesforceRequest(ACME, '/x').catch((e) => e);

            expect(error).toBeInstanceOf(SalesforceError);
            expect(error.message).toBe(
                'Could not reach https://acme.my.salesforce.com: Failed to fetch'
            );
        });

        it('lets an aborted request reject as it is', async () => {
            const abortError = new Error('aborted');
            abortError.name = 'AbortError';
            global.fetch = jest.fn(() => Promise.reject(abortError));

            await expect(salesforceRequest(ACME, '/x')).rejects.toBe(
                abortError
            );
        });
    });

    describe('queryAll', () => {
        it('follows nextRecordsUrl until the last batch', async () => {
            global.fetch = jest.fn((url) =>
                url.includes('/query/?q=')
                    ? jsonResponse({
                          done: false,
                          nextRecordsUrl: '/services/data/v51.0/query/01g-2000',
                          records: [{ Id: '1' }]
                      })
                    : jsonResponse({ done: true, records: [{ Id: '2' }] })
            );

            const records = await queryAll(ACME, 'SELECT Id FROM ApexClass');

            expect(records).toEqual([{ Id: '1' }, { Id: '2' }]);
            expect(fetch.mock.calls[1][0]).toBe(
                'https://acme.my.salesforce.com/services/data/v51.0/query/01g-2000'
            );
        });

        it('encodes the query and targets the tooling api when asked to', async () => {
            global.fetch = jest.fn(() =>
                jsonResponse({ done: true, records: [] })
            );

            await queryAll(
                ACME,
                "SELECT Id FROM ApexLog WHERE Status = 'Success'",
                {
                    tooling: true,
                    apiVersion: '60.0'
                }
            );

            expect(fetch.mock.calls[0][0]).toBe(
                'https://acme.my.salesforce.com/services/data/v60.0/tooling/query/?q=' +
                    encodeURIComponent(
                        "SELECT Id FROM ApexLog WHERE Status = 'Success'"
                    )
            );
        });
    });

    describe('api versions', () => {
        function mockVersions(versionsByInstance) {
            global.fetch = jest.fn((url) =>
                jsonResponse(
                    versionsByInstance[new URL(url).origin].map((version) => ({
                        version
                    }))
                )
            );
        }

        it('sorts the versions numerically', async () => {
            mockVersions({ [ACME.instanceUrl]: ['10.0', '9.0', '60.0'] });

            await expect(getApiVersions(ACME)).resolves.toEqual([
                '9.0',
                '10.0',
                '60.0'
            ]);
        });

        it('picks the newest version both orgs support', async () => {
            mockVersions({
                [ACME.instanceUrl]: ['58.0', '59.0', '60.0', '61.0'],
                [GLOBEX.instanceUrl]: ['58.0', '59.0', '60.0']
            });

            await expect(getCommonApiVersion(ACME, GLOBEX)).resolves.toBe(
                '60.0'
            );
        });

        it('fails when the orgs share no version', async () => {
            mockVersions({
                [ACME.instanceUrl]: ['61.0'],
                [GLOBEX.instanceUrl]: ['60.0']
            });

            await expect(getCommonApiVersion(ACME, GLOBEX)).rejects.toThrow(
                'The orgs do not share any api version'
            );
        });
    });

    describe('describe', () => {
        it('describes the org and one object', async () => {
            global.fetch = jest.fn(() => jsonResponse({}));

            await describeGlobal(ACME, '60.0');
            await describeSObject(ACME, 'My_Setting__c', '60.0');

            expect(fetch.mock.calls.map(([url]) => url)).toEqual([
                'https://acme.my.salesforce.com/services/data/v60.0/sobjects/',
                'https://acme.my.salesforce.com/services/data/v60.0/sobjects/My_Setting__c/describe/'
            ]);
        });
    });

    describe('mapWithConcurrency', () => {
        it('keeps the order of the items and caps the calls in flight', async () => {
            let inFlight = 0;
            let maxInFlight = 0;

            const results = await mapWithConcurrency(
                [30, 10, 20, 0, 5],
                2,
                async (delay) => {
                    inFlight++;
                    maxInFlight = Math.max(maxInFlight, inFlight);
                    await new Promise((resolve) => setTimeout(resolve, delay));
                    inFlight--;
                    return delay * 2;
                }
            );

            expect(results).toEqual([60, 20, 40, 0, 10]);
            expect(maxInFlight).toBe(2);
        });

        it('handles an empty list', async () => {
            await expect(mapWithConcurrency([], 4, jest.fn())).resolves.toEqual(
                []
            );
        });
    });
});
