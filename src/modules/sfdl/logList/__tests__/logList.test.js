import { createElement } from 'lwc';
import LogList from 'sfdl/logList';
import { showToastEvent } from 'sfdl/utils';

jest.mock('sfdl/utils', () => ({
    showToastEvent: jest.fn(),
    setKeyValueLocalStorage: jest.fn()
}));
jest.mock('file-saver', () => ({ saveAs: jest.fn() }));

const SESSION_INFORMATION = {
    instanceUrl: 'https://acme.my.salesforce.com',
    authToken: 'token',
    queryWhere: ''
};

const APEX_LOG_RECORDS = [
    {
        Id: '07L1',
        LastModifiedDate: '2026-08-12T10:20:30.000Z',
        LogLength: 1024,
        LogUser: { Name: 'John Doe' },
        Operation: '/services/data/ApexTesting',
        Status: 'Success'
    },
    {
        Id: '07L2',
        LastModifiedDate: '2026-08-12T11:20:30.000Z',
        LogLength: 2048,
        LogUser: { Name: 'Jane Roe' },
        Operation: 'VF-/apex__MyPage',
        Status: 'Success'
    }
];

// The bodies are left empty on purpose: sfdl-download-logs then waits for the
// background worker, which keeps the component mounted for the assertions below.
const APEX_LOG_LIST = [
    {
        id: '07L1',
        name: 'John Doe | log one',
        attributes: { url: '/one' },
        response: ''
    },
    {
        id: '07L2',
        name: 'Jane Roe | log two',
        attributes: { url: '/two' },
        response: ''
    }
];

function flushPromises() {
    return new Promise((resolve) => setTimeout(resolve, 0));
}

function mockSalesforceFetch(records = APEX_LOG_RECORDS) {
    global.fetch = jest.fn(() =>
        Promise.resolve({
            status: 200,
            json: () => Promise.resolve({ records })
        })
    );
}

// By default the body request never settles, which keeps sfdl-download-logs
// mounted so the download assertions can inspect what it received.
let downloadApexLogHandler = () => new Promise(() => {});

function mockBackgroundWorker(apexLogList = APEX_LOG_LIST) {
    downloadApexLogHandler = () => new Promise(() => {});
    chrome.runtime.sendMessage.mockImplementation((request) => {
        if (request.message === 'getApexLogList') {
            return Promise.resolve({ apexLogList });
        }
        if (request.message === 'downloadApexLog') {
            return downloadApexLogHandler(request);
        }
        return Promise.resolve({});
    });
}

function resolveApexLogBodies(body = 'the log body') {
    downloadApexLogHandler = (request) =>
        Promise.resolve({
            apexLogWithBody: {
                response: { id: request.apexLog.id, response: body }
            }
        });
}

async function createLogList() {
    const element = createElement('sfdl-log-list', { is: LogList });
    element.isAnaliseLogs = true;
    element.sessionInformation = SESSION_INFORMATION;
    document.body.appendChild(element);
    await flushPromises();
    await flushPromises();
    return element;
}

const rows = (element) => element.shadowRoot.querySelectorAll('.sfdl-log-row');
const logButtons = (element) =>
    element.shadowRoot.querySelectorAll('.displayLogButton');
const rowDownloadButtons = (element) =>
    element.shadowRoot.querySelectorAll('.downloadSingleLogButton');
const rowCheckboxes = (element) =>
    element.shadowRoot.querySelectorAll('.selectLogCheckbox');
const downloadAllButton = (element) =>
    element.shadowRoot.querySelector('.downloadLogsButton');
const selectAllCheckbox = (element) =>
    element.shadowRoot.querySelector('.selectAllLogsCheckbox');
const downloadLabel = (element) =>
    element.shadowRoot.querySelector('.sfdl-download-label').textContent;
const downloadLogsComponent = (element) =>
    element.shadowRoot.querySelector('sfdl-download-logs');

function click(node) {
    node.dispatchEvent(
        new CustomEvent('click', { bubbles: true, composed: true })
    );
}

function check(node, checked) {
    node.checked = checked;
    node.dispatchEvent(
        new CustomEvent('change', { bubbles: true, composed: true })
    );
}

function pressArrow(node, keyCode) {
    const event = new CustomEvent('keydown', { bubbles: true, composed: true });
    event.keyCode = keyCode;
    node.dispatchEvent(event);
}

describe('sfdl-log-list', () => {
    beforeEach(() => {
        mockSalesforceFetch();
        mockBackgroundWorker();
    });

    describe('rendering', () => {
        it('renders one row per retrieved log', async () => {
            const element = await createLogList();

            expect(rows(element).length).toBe(2);
            expect(
                [
                    ...element.shadowRoot.querySelectorAll('.displayLogButton')
                ].map((button) => button.textContent.trim())
            ).toEqual(['John Doe | log one', 'Jane Roe | log two']);
        });

        it('renders a download button on every row', async () => {
            const element = await createLogList();

            expect(rowDownloadButtons(element).length).toBe(2);
            expect(
                [...rowDownloadButtons(element)].map(
                    (button) => button.dataset.logid
                )
            ).toEqual(['07L1', '07L2']);
        });

        it('renders a selection checkbox on every row and a select all on top', async () => {
            const element = await createLogList();

            expect(rowCheckboxes(element).length).toBe(2);
            expect(selectAllCheckbox(element)).not.toBeNull();
        });

        it('starts with nothing selected and offers to download everything', async () => {
            const element = await createLogList();

            expect([...rowCheckboxes(element)].some((box) => box.checked)).toBe(false);
            expect(selectAllCheckbox(element).checked).toBe(false);
            expect(downloadLabel(element)).toBe('Download all logs');
        });

        it('informs the user when the org has no logs', async () => {
            mockSalesforceFetch([]);

            const element = await createLogList();

            expect(rows(element).length).toBe(0);
            expect(showToastEvent).toHaveBeenCalledWith(
                'info',
                'There are no logs to retrieve',
                SESSION_INFORMATION.instanceUrl
            );
        });
    });

    describe('individual log download', () => {
        it('downloads only the clicked log', async () => {
            const element = await createLogList();

            click(rowDownloadButtons(element)[1]);
            await flushPromises();

            const downloadLogs = downloadLogsComponent(element);
            expect(downloadLogs).not.toBeNull();
            expect(downloadLogs.logList.length).toBe(1);
            expect(downloadLogs.logList[0].id).toBe('07L2');
        });

        it('passes the current manipulation options down to the download component', async () => {
            const element = await createLogList();
            const manipulationOptions = [
                {
                    label: 'HEAP',
                    name: 'removeHeapAllocateAndStatementExecute',
                    checked: true
                }
            ];
            element.handleManipulationOptionsForDownloading(
                manipulationOptions
            );

            click(rowDownloadButtons(element)[0]);
            await flushPromises();

            expect(downloadLogsComponent(element).manipulationOptions).toEqual(
                manipulationOptions
            );
        });

        it('refuses to start a second download while one is running', async () => {
            const element = await createLogList();

            click(rowDownloadButtons(element)[0]);
            await flushPromises();
            showToastEvent.mockClear();

            click(rowDownloadButtons(element)[1]);
            await flushPromises();

            expect(downloadLogsComponent(element).logList[0].id).toBe('07L1');
            expect(showToastEvent).toHaveBeenCalledWith(
                'info',
                'sfdl',
                'There is a download in progress, wait for it to finish.'
            );
        });

        it('closes the download component once the process is completed', async () => {
            const element = await createLogList();

            click(rowDownloadButtons(element)[0]);
            await flushPromises();
            downloadLogsComponent(element).dispatchEvent(
                new CustomEvent('downloadprocesscompleted', { detail: {} })
            );
            await flushPromises();

            expect(downloadLogsComponent(element)).toBeNull();
        });
    });

    describe('download all logs', () => {
        it('hands the whole log list over to the download component', async () => {
            const element = await createLogList();

            click(downloadAllButton(element));
            await flushPromises();

            expect(downloadLogsComponent(element).logList.length).toBe(2);
        });
    });

    describe('opening a log', () => {
        it('announces that the details are loading', async () => {
            resolveApexLogBodies();
            const element = await createLogList();
            const isLoading = jest.fn();
            element.addEventListener('isloading', isLoading);

            click(logButtons(element)[0]);
            await flushPromises();

            expect(isLoading).toHaveBeenCalledTimes(1);
        });

        it('asks the background worker for the body and publishes the details', async () => {
            resolveApexLogBodies('USER_DEBUG|[1]|DEBUG|hello');
            const element = await createLogList();
            const logDetails = jest.fn();
            element.addEventListener('logdetails', logDetails);

            click(logButtons(element)[1]);
            await flushPromises();

            expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
                expect.objectContaining({ message: 'downloadApexLog' })
            );
            expect(logDetails.mock.calls[0][0].detail.logName).toBe(
                'Jane Roe | log two'
            );
            expect(logDetails.mock.calls[0][0].detail.logDetails.response).toBe(
                'USER_DEBUG|[1]|DEBUG|hello'
            );
        });

        it('reuses the cached body on the second visit', async () => {
            resolveApexLogBodies();
            const element = await createLogList();

            click(logButtons(element)[0]);
            await flushPromises();
            const callsAfterFirstVisit =
                chrome.runtime.sendMessage.mock.calls.length;

            click(logButtons(element)[0]);
            await flushPromises();

            expect(chrome.runtime.sendMessage.mock.calls.length).toBe(
                callsAfterFirstVisit
            );
        });

        it('walks the list with the arrow keys', async () => {
            resolveApexLogBodies();
            const element = await createLogList();
            click(logButtons(element)[0]);
            await flushPromises();

            const logDetails = jest.fn();
            element.addEventListener('logdetails', logDetails);
            pressArrow(logButtons(element)[0], 40);
            await flushPromises();
            expect(logDetails.mock.calls[0][0].detail.logName).toBe(
                'Jane Roe | log two'
            );

            pressArrow(logButtons(element)[1], 38);
            await flushPromises();
            expect(logDetails.mock.calls[1][0].detail.logName).toBe(
                'John Doe | log one'
            );
        });

        it('wraps around when it walks past the end of the list', async () => {
            resolveApexLogBodies();
            const element = await createLogList();
            click(logButtons(element)[1]);
            await flushPromises();

            const logDetails = jest.fn();
            element.addEventListener('logdetails', logDetails);
            pressArrow(logButtons(element)[1], 40);
            await flushPromises();

            expect(logDetails.mock.calls[0][0].detail.logName).toBe(
                'John Doe | log one'
            );
        });
    });

    describe('download feedback', () => {
        it('shows how many logs have been retrieved so far', async () => {
            const element = await createLogList();

            click(downloadAllButton(element));
            await flushPromises();
            const processBar =
                element.shadowRoot.querySelector('sfdl-process-bar');
            const updateProgressBar = jest.spyOn(
                processBar,
                'updateProgressBar'
            );

            downloadLogsComponent(element).dispatchEvent(
                new CustomEvent('downloadprogress', {
                    detail: { logsDownloaded: 1 }
                })
            );
            await flushPromises();

            expect(processBar.total).toBe(2);
            expect(updateProgressBar).toHaveBeenCalledWith(1);
        });

        it('stops the download and warns the user when it is cancelled', async () => {
            const element = await createLogList();
            click(downloadAllButton(element));
            await flushPromises();
            showToastEvent.mockClear();

            click(
                element.shadowRoot.querySelector('button[title="cancel logs"]')
            );
            await flushPromises();

            expect(downloadLogsComponent(element)).toBeNull();
            expect(showToastEvent).toHaveBeenCalledWith(
                'warning',
                'sfdl',
                'Download cancelled!'
            );
        });
    });

    describe('query errors', () => {
        it('surfaces an invalid query coming back from the tooling api', async () => {
            global.fetch = jest.fn(() =>
                Promise.resolve({
                    status: 400,
                    json: () => Promise.resolve({})
                })
            );

            const element = await createLogList();

            expect(rows(element).length).toBe(0);
            expect(showToastEvent).toHaveBeenCalledWith(
                'error',
                'Invalid query :(',
                expect.any(String)
            );
        });

        it('surfaces an expired session', async () => {
            global.fetch = jest.fn(() =>
                Promise.resolve({
                    status: 401,
                    statusText: 'Unauthorized',
                    json: () => Promise.resolve({})
                })
            );

            const element = await createLogList();

            expect(rows(element).length).toBe(0);
            expect(showToastEvent).toHaveBeenCalledWith(
                'error',
                'Invalid session :(',
                'Unauthorized: Invalid session'
            );
        });
    });

    describe('selecting logs', () => {
        it('counts the ticked logs on the download button', async () => {
            const element = await createLogList();

            check(rowCheckboxes(element)[0], true);
            await flushPromises();

            expect(downloadLabel(element)).toBe('Download selected logs (1)');
            expect(downloadAllButton(element).disabled).toBe(false);
        });

        it('downloads only the ticked logs', async () => {
            const element = await createLogList();
            check(rowCheckboxes(element)[1], true);
            await flushPromises();

            click(downloadAllButton(element));
            await flushPromises();

            const downloadLogs = downloadLogsComponent(element);
            expect(downloadLogs.logList.length).toBe(1);
            expect(downloadLogs.logList[0].id).toBe('07L2');
        });

        it('ticks and unticks every row from the select all checkbox', async () => {
            const element = await createLogList();

            check(selectAllCheckbox(element), true);
            await flushPromises();
            expect([...rowCheckboxes(element)].every((box) => box.checked)).toBe(true);
            expect(downloadLabel(element)).toBe('Download selected logs (2)');

            check(selectAllCheckbox(element), false);
            await flushPromises();
            expect([...rowCheckboxes(element)].some((box) => box.checked)).toBe(false);
            expect(downloadLabel(element)).toBe('Download all logs');
        });

        it('ticks the select all checkbox once every row is ticked one by one', async () => {
            const element = await createLogList();

            check(rowCheckboxes(element)[0], true);
            await flushPromises();
            expect(selectAllCheckbox(element).checked).toBe(false);

            check(rowCheckboxes(element)[1], true);
            await flushPromises();
            expect(selectAllCheckbox(element).checked).toBe(true);
        });

        it('unticking a log brings the label back to the whole list', async () => {
            const element = await createLogList();
            check(rowCheckboxes(element)[0], true);
            await flushPromises();

            check(rowCheckboxes(element)[0], false);
            await flushPromises();

            expect(downloadLabel(element)).toBe('Download all logs');
        });
    });
});
