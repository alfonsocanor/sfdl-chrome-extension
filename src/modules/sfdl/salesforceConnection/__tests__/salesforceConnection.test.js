import {
    SalesforceError,
    salesforceRequest,
    queryAll,
    getApiVersions,
    getCommonApiVersion,
    describeGlobal,
    describeSObject,
    getApexLogs,
    getApexLogBody,
    mapWithConcurrency,
    getRecordNames,
    shortId,
    updateRecord
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

    describe('getApexLogs', () => {
        it('queries the logs on the tooling api, newest first', async () => {
            global.fetch = jest.fn(() =>
                jsonResponse({ done: true, records: [{ Id: '07L1' }] })
            );

            await expect(getApexLogs(ACME)).resolves.toEqual([{ Id: '07L1' }]);
            expect(decodeURIComponent(fetch.mock.calls[0][0])).toBe(
                'https://acme.my.salesforce.com/services/data/v51.0/tooling/query/?q=' +
                    'SELECT Id, LastModifiedDate, LogLength, LogUser.Name, Operation, Status FROM ApexLog ORDER BY LastModifiedDate DESC'
            );
        });

        it('takes the where clause of the session instead of the default order', async () => {
            global.fetch = jest.fn(() =>
                jsonResponse({ done: true, records: [] })
            );

            await getApexLogs({
                ...ACME,
                queryWhere: 'WHERE LogLength > 1000'
            });

            expect(decodeURIComponent(fetch.mock.calls[0][0])).toMatch(
                /FROM ApexLog WHERE LogLength > 1000$/
            );
        });
    });

    describe('getApexLogBody', () => {
        it('downloads the body of the log as text', async () => {
            global.fetch = jest.fn(() =>
                Promise.resolve({
                    status: 200,
                    text: () => Promise.resolve('body')
                })
            );

            await expect(
                getApexLogBody(ACME, {
                    attributes: {
                        url: '/services/data/v51.0/tooling/sobjects/ApexLog/07L1'
                    }
                })
            ).resolves.toBe('body');
            expect(fetch.mock.calls[0][0]).toBe(
                'https://acme.my.salesforce.com/services/data/v51.0/tooling/sobjects/ApexLog/07L1/Body'
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

describe('salesforceConnection deleting and limits', () => {
    const {
        deleteRecords,
        isPermissionError,
        isPermissionOutcome,
        getLimits,
        queryCount
    } = require('sfdl/salesforceConnection');

    it('deleteRecords deletes through the collections api and reports each record', async () => {
        global.fetch = jest.fn(() =>
            jsonResponse([
                { id: '07L1', success: true, errors: [] },
                {
                    id: '07L2',
                    success: false,
                    errors: [
                        {
                            statusCode: 'ENTITY_IS_DELETED',
                            message: 'entity is deleted'
                        }
                    ]
                }
            ])
        );

        const outcome = await deleteRecords(ACME, ['07L1', '07L2']);

        expect(fetch).toHaveBeenCalledWith(
            ACME.instanceUrl +
                '/services/data/v51.0/composite/sobjects?allOrNone=false&ids=07L1,07L2',
            expect.objectContaining({ method: 'DELETE' })
        );
        expect(outcome).toEqual({
            deleted: ['07L1'],
            failed: [
                {
                    id: '07L2',
                    message: 'entity is deleted',
                    errorCode: 'ENTITY_IS_DELETED'
                }
            ]
        });
    });

    it('deleteRecords goes 200 ids at a time and tells the progress after each chunk', async () => {
        const ids = Array.from({ length: 201 }, (unused, index) => 'id' + index);
        global.fetch = jest.fn((url) => {
            const chunk = url.split('ids=')[1].split(',');
            return jsonResponse(chunk.map((id) => ({ id, success: true })));
        });
        const onProgress = jest.fn();

        const outcome = await deleteRecords(ACME, ids, { onProgress });

        expect(fetch).toHaveBeenCalledTimes(2);
        expect(outcome.deleted.length).toBe(201);
        expect(onProgress.mock.calls).toEqual([
            [200, 201],
            [201, 201]
        ]);
    });

    it('isPermissionError knows a 403 and the insufficient access codes', () => {
        expect(isPermissionError({ status: 403 })).toBe(true);
        expect(
            isPermissionError({
                status: 400,
                errorCode: 'INSUFFICIENT_ACCESS_OR_READONLY'
            })
        ).toBe(true);
        expect(
            isPermissionError({ status: 404, errorCode: 'NOT_FOUND' })
        ).toBe(false);
        expect(isPermissionError(undefined)).toBe(false);
    });

    it('isPermissionOutcome is true only when every record was refused for access', () => {
        const refused = (id) => ({
            id,
            message: 'no',
            errorCode: 'INSUFFICIENT_ACCESS_OR_READONLY'
        });

        expect(
            isPermissionOutcome({ deleted: [], failed: [refused('a'), refused('b')] })
        ).toBe(true);
        expect(
            isPermissionOutcome({ deleted: ['c'], failed: [refused('a')] })
        ).toBe(false);
        expect(
            isPermissionOutcome({
                deleted: [],
                failed: [{ id: 'a', message: 'gone', errorCode: 'ENTITY_IS_DELETED' }]
            })
        ).toBe(false);
        expect(isPermissionOutcome({ deleted: [], failed: [] })).toBe(false);
    });

    it('getLimits reads the limits of the org', async () => {
        global.fetch = jest.fn(() =>
            jsonResponse({ DailyApiRequests: { Max: 15000, Remaining: 14000 } })
        );

        const limits = await getLimits(ACME);

        expect(fetch.mock.calls[0][0]).toBe(
            ACME.instanceUrl + '/services/data/v51.0/limits/'
        );
        expect(limits.DailyApiRequests.Remaining).toBe(14000);
    });

    it('queryCount returns the total of a count query', async () => {
        global.fetch = jest.fn(() => jsonResponse({ totalSize: 42, records: [] }));

        const total = await queryCount(ACME, 'SELECT COUNT() FROM AsyncApexJob');

        expect(fetch.mock.calls[0][0]).toContain(
            '/services/data/v51.0/query/?q=SELECT%20COUNT()'
        );
        expect(total).toBe(42);
    });

    it('getRecordNames names the records of valid ids by their short id, a query per hundred', async () => {
        const ids = Array.from({ length: 101 }, (unused, index) => '005' + String(index).padStart(12, '0'));
        global.fetch = jest.fn((url) => {
            const soql = decodeURIComponent(url.split('?q=')[1]);
            const records = soql.includes("'005000000000000'") ?
                [{ Id: '005000000000000AAA', Name: 'Ann' }] :
                [{ Id: '005000000000100AAA', Name: 'Bob' }];
            return jsonResponse({ done: true, records });
        });

        const names = await getRecordNames(ACME, 'User', [...ids, ids[0] + 'AAA', "x' OR Name != '", '', undefined], { apiVersion: '60.0' });

        expect(fetch).toHaveBeenCalledTimes(2);
        expect(fetch.mock.calls[0][0]).toContain('/services/data/v60.0/query/');
        expect(decodeURIComponent(fetch.mock.calls[0][0])).toContain("SELECT Id, Name FROM User WHERE Id IN ('005000000000000','005000000000001'");
        expect(decodeURIComponent(fetch.mock.calls[0][0])).not.toContain('OR Name');
        expect(names.get('005000000000000')).toBe('Ann');
        expect(names.get('005000000000100')).toBe('Bob');
        expect(shortId('005000000000000AAA')).toBe('005000000000000');
    });

    it('getRecordNames asks nothing of the org without ids', async () => {
        global.fetch = jest.fn();

        expect((await getRecordNames(ACME, 'User', [])).size).toBe(0);
        expect(fetch).not.toHaveBeenCalled();
    });

    it('updateRecord patches the fields of one record', async () => {
        global.fetch = jest.fn(() => Promise.resolve({ status: 204, statusText: 'No Content' }));

        const result = await updateRecord(ACME, 'TransactionSecurityPolicy', '0w1', { State: 'Enabled' }, { apiVersion: '60.0' });

        expect(result).toBeNull();
        expect(fetch).toHaveBeenCalledWith(
            ACME.instanceUrl + '/services/data/v60.0/sobjects/TransactionSecurityPolicy/0w1',
            expect.objectContaining({ method: 'PATCH', body: '{"State":"Enabled"}' })
        );
        expect(fetch.mock.calls[0][1].credentials).toBeUndefined();
    });

    it('salesforceRequest sends the cookies of the org when asked', async () => {
        global.fetch = jest.fn(() => jsonResponse([]));

        await salesforceRequest(ACME, '/cometd/60.0/handshake', { method: 'POST', credentials: 'include' });

        expect(fetch.mock.calls[0][1].credentials).toBe('include');
    });
});
