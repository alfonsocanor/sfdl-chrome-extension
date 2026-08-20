/**
 * The background service worker is a plain script: it registers its listeners on
 * import, so every test re-imports it with a fresh chrome mock.
 */
function loadBackgroundWorker() {
    let onMessage;
    let onTabRemoved;

    jest.isolateModules(() => {
        require('../background.js');
        onMessage = chrome.runtime.onMessage.addListener.mock.calls[0][0];
        onTabRemoved = chrome.tabs.onRemoved.addListener.mock.calls[0][0];
    });

    return { onMessage, onTabRemoved };
}

function apexLogRecord(overrides = {}) {
    return {
        Id: '07L000000000001',
        LastModifiedDate: '2026-08-12T10:20:30.000Z',
        LogLength: 1024,
        LogUser: { Name: 'John Doe' },
        Operation: '/services/Soap/ApexTesting',
        Status: 'Success',
        attributes: {
            url: '/services/data/v51.0/tooling/sobjects/ApexLog/07L000000000001'
        },
        ...overrides
    };
}

function flushPromises() {
    return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('background service worker', () => {
    describe('getApexLogList', () => {
        it('maps the tooling api records into the shape the ui consumes', () => {
            const { onMessage } = loadBackgroundWorker();
            const sendResponse = jest.fn();

            onMessage(
                { message: 'getApexLogList', apexLogList: [apexLogRecord()] },
                {},
                sendResponse
            );

            const [{ apexLogList }] = sendResponse.mock.calls[0];
            expect(apexLogList).toHaveLength(1);
            expect(apexLogList[0].id).toBe('07L000000000001');
            expect(apexLogList[0].attributes).toEqual(
                apexLogRecord().attributes
            );
            expect(apexLogList[0].response).toBe('');
        });

        it('builds a readable log name out of the record fields', () => {
            const { onMessage } = loadBackgroundWorker();
            const sendResponse = jest.fn();

            onMessage(
                { message: 'getApexLogList', apexLogList: [apexLogRecord()] },
                {},
                sendResponse
            );

            const [{ apexLogList }] = sendResponse.mock.calls[0];
            expect(apexLogList[0].name).toMatch(
                /^John Doe \| servicesSoapApexTesting \| 1024bytes \| \d{2}\/\d{2} \d{2}h\d{2}m\d{2}s \| Success$/
            );
        });

        it('keeps only the managed package suffix of a namespaced operation', () => {
            const { onMessage } = loadBackgroundWorker();
            const sendResponse = jest.fn();

            onMessage(
                {
                    message: 'getApexLogList',
                    apexLogList: [
                        apexLogRecord({ Operation: 'VF-/apex__MyPage' })
                    ]
                },
                {},
                sendResponse
            );

            const [{ apexLogList }] = sendResponse.mock.calls[0];
            expect(apexLogList[0].name).toContain('| MyPage |');
        });

        it('answers synchronously', () => {
            const { onMessage } = loadBackgroundWorker();

            const isAsynchronous = onMessage(
                { message: 'getApexLogList', apexLogList: [] },
                {},
                jest.fn()
            );

            expect(isAsynchronous).toBe(false);
        });
    });

    describe('downloadApexLog', () => {
        it('fetches the log body from the org and hands it back', async () => {
            global.fetch = jest.fn(() =>
                Promise.resolve({
                    status: 200,
                    text: () => Promise.resolve('the log body')
                })
            );
            const { onMessage } = loadBackgroundWorker();
            const sendResponse = jest.fn();
            const apexLog = {
                id: '07L1',
                name: 'a log',
                attributes: {
                    url: '/services/data/v51.0/tooling/sobjects/ApexLog/07L1'
                }
            };

            const isAsynchronous = onMessage(
                {
                    message: 'downloadApexLog',
                    sessionInformation: {
                        instanceUrl: 'https://acme.my.salesforce.com',
                        authToken: 'token'
                    },
                    apexLog
                },
                {},
                sendResponse
            );
            await flushPromises();

            expect(isAsynchronous).toBe(true);
            expect(global.fetch).toHaveBeenCalledWith(
                'https://acme.my.salesforce.com/services/data/v51.0/tooling/sobjects/ApexLog/07L1/Body',
                expect.objectContaining({ method: 'GET' })
            );
            expect(sendResponse).toHaveBeenCalledWith({
                apexLogWithBody: expect.objectContaining({
                    response: {
                        id: '07L1',
                        name: 'a log',
                        response: 'the log body'
                    }
                })
            });
        });

        it('sends the session token as a bearer authorization header', async () => {
            global.fetch = jest.fn(() =>
                Promise.resolve({
                    status: 200,
                    text: () => Promise.resolve('body')
                })
            );
            const { onMessage } = loadBackgroundWorker();

            onMessage(
                {
                    message: 'downloadApexLog',
                    sessionInformation: {
                        instanceUrl: 'https://acme',
                        authToken: 'a-token'
                    },
                    apexLog: {
                        id: '07L1',
                        name: 'a log',
                        attributes: { url: '/url' }
                    }
                },
                {},
                jest.fn()
            );
            await flushPromises();

            expect(global.fetch.mock.calls[0][1].headers.Authorization).toBe(
                'Bearer a-token'
            );
        });
    });

    describe('downloadApexLogs', () => {
        it('answers once every log has been retrieved', async () => {
            global.fetch = jest.fn(() =>
                Promise.resolve({
                    status: 200,
                    text: () => Promise.resolve('body')
                })
            );
            const { onMessage } = loadBackgroundWorker();
            const sendResponse = jest.fn();

            onMessage(
                {
                    message: 'downloadApexLogs',
                    sessionInformation: {
                        instanceUrl: 'https://acme',
                        authToken: 'token'
                    },
                    apexLogList: [apexLogRecord()]
                },
                {},
                sendResponse
            );
            await flushPromises();

            expect(sendResponse).toHaveBeenCalledWith({ logsDownloaded: true });
            expect(chrome.storage.local.set).toHaveBeenCalledWith({
                isDownloadInProgress: false
            });
        });

        it('exposes the retrieved counter through downloadProgressBar', async () => {
            global.fetch = jest.fn(() =>
                Promise.resolve({
                    status: 200,
                    text: () => Promise.resolve('body')
                })
            );
            const { onMessage } = loadBackgroundWorker();

            onMessage(
                {
                    message: 'downloadApexLogs',
                    sessionInformation: {
                        instanceUrl: 'https://acme',
                        authToken: 'token'
                    },
                    apexLogList: [apexLogRecord()]
                },
                {},
                jest.fn()
            );

            const progress = jest.fn();
            onMessage({ message: 'downloadProgressBar' }, {}, progress);
            expect(progress).toHaveBeenCalledWith({
                totalLogsCompletelyRetrieved: 0
            });

            await flushPromises();
        });
    });

    describe('getLogsDownloaded', () => {
        it('drains the downloaded logs in batches', async () => {
            global.fetch = jest.fn(() =>
                Promise.resolve({
                    status: 200,
                    text: () => Promise.resolve('body')
                })
            );
            const { onMessage } = loadBackgroundWorker();

            onMessage(
                {
                    message: 'downloadApexLogs',
                    sessionInformation: {
                        instanceUrl: 'https://acme',
                        authToken: 'token'
                    },
                    apexLogList: [apexLogRecord({ Id: '07L1' })]
                },
                {},
                jest.fn()
            );
            await flushPromises();

            const sendResponse = jest.fn();
            onMessage({ message: 'getLogsDownloaded' }, {}, sendResponse);

            const [{ batchLogs2Process, continueProcess }] =
                sendResponse.mock.calls[0];
            expect(batchLogs2Process).toHaveLength(1);
            expect(continueProcess).toBe(false);
        });
    });

    describe('unknown messages', () => {
        it('are answered synchronously without a response', () => {
            const { onMessage } = loadBackgroundWorker();
            const sendResponse = jest.fn();

            expect(
                onMessage({ message: 'somethingElse' }, {}, sendResponse)
            ).toBe(false);
            expect(sendResponse).not.toHaveBeenCalled();
        });
    });

    describe('tab closed', () => {
        it('flags the download as no longer in progress', () => {
            const { onTabRemoved } = loadBackgroundWorker();

            onTabRemoved();

            expect(chrome.storage.local.set).toHaveBeenCalledWith({
                isDownloadInProgress: false
            });
        });
    });
});
