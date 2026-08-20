import { createElement } from 'lwc';
import DownloadLogs from 'sfdl/downloadLogs';
import { saveAs } from 'file-saver';
import { showToastEvent } from 'sfdl/utils';

jest.mock('file-saver', () => ({ saveAs: jest.fn() }));
jest.mock('sfdl/utils', () => ({ showToastEvent: jest.fn() }));

const mockZipFolder = {
    file: jest.fn(),
    generateAsync: jest.fn(() => Promise.resolve('zip-blob'))
};
const mockZipInstance = { folder: jest.fn(() => mockZipFolder) };

jest.mock('jszip', () => jest.fn(() => mockZipInstance));

const SESSION_INFORMATION = {
    instanceUrl: 'https://acme.my.salesforce.com',
    authToken: 'token'
};

function apexLog(overrides = {}) {
    return {
        id: '07L000000000001',
        name: 'John Doe | ApexTesting | 1024bytes | 01/07 10h20m30s | Success',
        attributes: {
            url: '/services/data/v51.0/tooling/sobjects/ApexLog/07L000000000001'
        },
        response: 'USER_DEBUG|[1]|DEBUG|hello',
        ...overrides
    };
}

function flushPromises() {
    return new Promise((resolve) => setTimeout(resolve, 0));
}

async function createDownloadLogs(props = {}) {
    const element = createElement('sfdl-download-logs', { is: DownloadLogs });
    Object.assign(element, {
        sessionInformation: SESSION_INFORMATION,
        manipulationOptions: undefined,
        ...props
    });
    document.body.appendChild(element);
    await flushPromises();
    return element;
}

describe('sfdl-download-logs', () => {
    beforeEach(() => {
        mockZipFolder.file.mockClear();
        mockZipFolder.generateAsync.mockClear();
        mockZipInstance.folder.mockClear();
    });

    describe('single log download', () => {
        it('saves one plain .log file instead of a zip', async () => {
            await createDownloadLogs({ logList: [apexLog()] });

            expect(mockZipInstance.folder).not.toHaveBeenCalled();
            expect(saveAs).toHaveBeenCalledTimes(1);
            expect(saveAs.mock.calls[0][1]).toBe(
                'John Doe  ApexTesting  1024bytes  01-07 10h20m30s  Success - 07L000000000001.log'
            );
        });

        it('saves the log body as the file content', async () => {
            const blobParts = [];
            const NativeBlob = global.Blob;
            global.Blob = function TrackedBlob(parts, options) {
                blobParts.push(parts);
                return new NativeBlob(parts, options);
            };

            try {
                await createDownloadLogs({ logList: [apexLog()] });
            } finally {
                global.Blob = NativeBlob;
            }

            expect(blobParts[0]).toEqual(['USER_DEBUG|[1]|DEBUG|hello']);
        });

        it('fetches the log body from the background worker when it is not cached yet', async () => {
            chrome.runtime.sendMessage.mockResolvedValue({
                apexLogWithBody: {
                    response: { response: 'freshly fetched body' }
                }
            });
            const log = apexLog({ response: '' });

            await createDownloadLogs({ logList: [log] });

            expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
                message: 'downloadApexLog',
                sessionInformation: SESSION_INFORMATION,
                apexLog: expect.objectContaining({ id: log.id })
            });
            expect(saveAs).toHaveBeenCalledTimes(1);
        });

        it('does not call the background worker when the body is already cached', async () => {
            await createDownloadLogs({ logList: [apexLog()] });

            expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
        });

        it('applies the manipulation options to the downloaded log', async () => {
            const blobParts = [];
            const NativeBlob = global.Blob;
            global.Blob = function TrackedBlob(parts, options) {
                blobParts.push(parts);
                return new NativeBlob(parts, options);
            };

            try {
                await createDownloadLogs({
                    logList: [
                        apexLog({
                            response: 'HEAP_ALLOCATE|noise\nUSER_DEBUG|signal'
                        })
                    ],
                    manipulationOptions: [
                        {
                            label: 'HEAP',
                            name: 'removeHeapAllocateAndStatementExecute',
                            checked: true
                        }
                    ]
                });
            } finally {
                global.Blob = NativeBlob;
            }

            expect(blobParts[0]).toEqual(['USER_DEBUG|signal']);
        });

        it('reports the progress and the end of the process', async () => {
            const progress = jest.fn();
            const completed = jest.fn();
            const element = createElement('sfdl-download-logs', {
                is: DownloadLogs
            });
            element.sessionInformation = SESSION_INFORMATION;
            element.logList = [apexLog()];
            element.addEventListener('downloadprogress', progress);
            element.addEventListener('downloadprocesscompleted', completed);

            document.body.appendChild(element);
            await flushPromises();

            expect(progress).toHaveBeenCalledTimes(1);
            expect(progress.mock.calls[0][0].detail).toEqual({
                logsDownloaded: 1
            });
            expect(completed).toHaveBeenCalledTimes(1);
        });
    });

    describe('multiple logs download', () => {
        it('zips every log under the sfdl folder', async () => {
            await createDownloadLogs({
                logList: [
                    apexLog({ id: '07L1', name: 'a | b', response: 'first' }),
                    apexLog({ id: '07L2', name: 'c | d', response: 'second' })
                ]
            });

            expect(mockZipInstance.folder).toHaveBeenCalledWith(
                'Salesforce Debug Logs'
            );
            expect(mockZipFolder.file).toHaveBeenCalledTimes(2);
            expect(mockZipFolder.file.mock.calls[0][0]).toBe(
                'sfdl/a  b - 07L1.log'
            );
            expect(mockZipFolder.file.mock.calls[1][0]).toBe(
                'sfdl/c  d - 07L2.log'
            );
            expect(saveAs).toHaveBeenCalledWith('zip-blob', 'sfdl-ApexLog.zip');
        });

        it('reports the progress once per log', async () => {
            const progress = jest.fn();
            const element = createElement('sfdl-download-logs', {
                is: DownloadLogs
            });
            element.sessionInformation = SESSION_INFORMATION;
            element.logList = [
                apexLog({ id: '07L1' }),
                apexLog({ id: '07L2' }),
                apexLog({ id: '07L3' })
            ];
            element.addEventListener('downloadprogress', progress);

            document.body.appendChild(element);
            await flushPromises();

            expect(
                progress.mock.calls.map((call) => call[0].detail.logsDownloaded)
            ).toEqual([1, 2, 3]);
        });

        it('stops adding logs to the zip once the download is cancelled', async () => {
            const completed = jest.fn();
            const element = createElement('sfdl-download-logs', {
                is: DownloadLogs
            });
            element.sessionInformation = SESSION_INFORMATION;
            element.logList = [
                apexLog({ id: '07L1' }),
                apexLog({ id: '07L2' })
            ];
            element.addEventListener('downloadprocesscompleted', completed);

            document.body.appendChild(element);
            element.cancelDownload();
            await flushPromises();

            expect(mockZipFolder.file.mock.calls.length).toBeLessThan(2);
            expect(saveAs).not.toHaveBeenCalled();
            expect(completed).toHaveBeenCalledTimes(1);
            expect(showToastEvent).not.toHaveBeenCalled();
        });

        it('reports an error toast when the download blows up', async () => {
            mockZipFolder.generateAsync.mockRejectedValueOnce(
                new Error('zip exploded')
            );
            const completed = jest.fn();
            const element = createElement('sfdl-download-logs', {
                is: DownloadLogs
            });
            element.sessionInformation = SESSION_INFORMATION;
            element.logList = [
                apexLog({ id: '07L1' }),
                apexLog({ id: '07L2' })
            ];
            element.addEventListener('downloadprocesscompleted', completed);

            document.body.appendChild(element);
            await flushPromises();

            expect(saveAs).not.toHaveBeenCalled();
            expect(completed).toHaveBeenCalledTimes(1);
            expect(showToastEvent).toHaveBeenCalledWith(
                'error',
                'sfdl',
                'The download could not be completed: zip exploded'
            );
        });
    });
});
