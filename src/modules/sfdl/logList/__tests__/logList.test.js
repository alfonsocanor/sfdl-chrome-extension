import { createElement } from 'lwc';
import LogList from 'sfdl/logList';
import { showToastEvent, confirmDialog, alertDialog } from 'sfdl/utils';
import { deleteRecords, SalesforceError } from 'sfdl/salesforceConnection';

jest.mock('sfdl/utils', () => ({
    showToastEvent: jest.fn(),
    setKeyValueLocalStorage: jest.fn(),
    confirmDialog: jest.fn(() => Promise.resolve(true)),
    alertDialog: jest.fn(() => Promise.resolve(true))
}));
jest.mock('sfdl/salesforceConnection', () =>
    Object.assign({}, jest.requireActual('sfdl/salesforceConnection'), {
        deleteRecords: jest.fn()
    })
);
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
const emptyMessage = (element) =>
    element.shadowRoot.querySelector('.sfdl-log-list__message');
const logButtons = (element) =>
    element.shadowRoot.querySelectorAll('.displayLogButton');
const rowDownloadButtons = (element) =>
    element.shadowRoot.querySelectorAll('.downloadSingleLogButton');
const rowDeleteButtons = (element) =>
    element.shadowRoot.querySelectorAll('.deleteSingleLogButton');
const deleteLogsButton = (element) =>
    element.shadowRoot.querySelector('.deleteLogsButton');
const deleteLabel = (element) =>
    element.shadowRoot.querySelector('.sfdl-delete-label').textContent;
const rowCheckboxes = (element) =>
    element.shadowRoot.querySelectorAll('.selectLogCheckbox');
const downloadAllButton = (element) =>
    element.shadowRoot.querySelector('.downloadLogsButton');
const selectAllCheckbox = (element) =>
    element.shadowRoot.querySelector('.selectAllLogsCheckbox');
const clearSelectionButton = (element) =>
    element.shadowRoot.querySelector('.clearSelectionButton');
const downloadLabelElement = (element) =>
    element.shadowRoot.querySelector('.sfdl-download-label');
const downloadLabel = (element) => downloadLabelElement(element).textContent;
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
        it('outlines its rows while the logs are queried', async () => {
            let answer;
            global.fetch = jest.fn(
                () =>
                    new Promise((resolve) => {
                        answer = resolve;
                    })
            );
            const element = createElement('sfdl-log-list', { is: LogList });
            element.isAnaliseLogs = true;
            element.sessionInformation = SESSION_INFORMATION;
            document.body.appendChild(element);
            await flushPromises();

            const stencil = element.shadowRoot.querySelector(
                'sfdl-loading-stencil'
            );
            expect(stencil.type).toBe('logList');

            answer({
                status: 200,
                json: () => Promise.resolve({ records: APEX_LOG_RECORDS })
            });
            await flushPromises();
            await flushPromises();
            await flushPromises();

            expect(
                element.shadowRoot.querySelector('sfdl-loading-stencil')
            ).toBeNull();
            expect(rows(element).length).toBe(2);
        });

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

            expect([...rowCheckboxes(element)].some((box) => box.checked)).toBe(
                false
            );
            expect(selectAllCheckbox(element).checked).toBe(false);
            expect(downloadLabel(element)).toBe('Download all logs');
        });

        it('adopts its stylesheet once however often it renders', async () => {
            const element = await createLogList();

            check(rowCheckboxes(element)[0], true);
            await flushPromises();
            check(rowCheckboxes(element)[1], true);
            await flushPromises();

            // The stencil shown while loading adopts a sheet of its own.
            const sheets = document.adoptedStyleSheets.map(
                (sheet) => sheet.cssText
            );
            expect(
                sheets.filter((text) => text.includes('.sfdl-log-row {'))
            ).toHaveLength(1);
            expect(new Set(sheets).size).toBe(sheets.length);
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
            expect(emptyMessage(element).textContent).toBe(
                'There are no logs in this org'
            );
        });

        it('says no log matches when a query filter left them all out', async () => {
            mockSalesforceFetch([]);
            const element = createElement('sfdl-log-list', { is: LogList });
            element.isAnaliseLogs = true;
            element.sessionInformation = {
                ...SESSION_INFORMATION,
                queryWhere: "WHERE Status = 'Failed'"
            };
            document.body.appendChild(element);
            await flushPromises();
            await flushPromises();

            expect(emptyMessage(element).textContent).toBe(
                'No logs match the query filter'
            );
        });

        it('says nothing about an empty list while there are logs', async () => {
            const element = await createLogList();

            expect(emptyMessage(element)).toBeNull();
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

        it('starts the same download from the label next to the icon', async () => {
            const element = await createLogList();

            click(downloadLabelElement(element));
            await flushPromises();

            expect(downloadLogsComponent(element).logList.length).toBe(2);
        });

        it('starts the selected download from the label too', async () => {
            const element = await createLogList();
            check(rowCheckboxes(element)[0], true);
            await flushPromises();

            click(downloadLabelElement(element));
            await flushPromises();

            const downloadLogs = downloadLogsComponent(element);
            expect(downloadLogs.logList.length).toBe(1);
            expect(downloadLogs.logList[0].id).toBe('07L1');
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

        it('highlights the whole row, not just the log name', async () => {
            resolveApexLogBodies();
            const element = await createLogList();

            click(logButtons(element)[1]);
            await flushPromises();

            expect(rows(element)[1].style.boxShadow).toBeTruthy();
            expect(rows(element)[1].style.outline).toBeTruthy();
            expect(logButtons(element)[1].style.boxShadow).toBeFalsy();
        });

        it('moves the highlight to the row that was opened last', async () => {
            resolveApexLogBodies();
            const element = await createLogList();
            click(logButtons(element)[0]);
            await flushPromises();

            click(logButtons(element)[1]);
            await flushPromises();

            expect(rows(element)[0].style.boxShadow).toBe('none');
            expect(rows(element)[1].style.boxShadow).toBeTruthy();
            expect(rows(element)[1].style.boxShadow).not.toBe('none');
        });

        it('highlights the row reached with the arrow keys', async () => {
            resolveApexLogBodies();
            const element = await createLogList();
            click(logButtons(element)[0]);
            await flushPromises();

            pressArrow(logButtons(element)[0], 40);
            await flushPromises();

            expect(rows(element)[0].style.boxShadow).toBe('none');
            expect(rows(element)[1].style.boxShadow).not.toBe('none');
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

    describe('comparing two logs', () => {
        const compareButton = (element) =>
            element.shadowRoot.querySelector('.compareLogsButton');

        it('offers to compare only when exactly two logs are ticked', async () => {
            const element = await createLogList();

            expect(compareButton(element)).toBeNull();

            check(rowCheckboxes(element)[0], true);
            await flushPromises();
            expect(compareButton(element)).toBeNull();

            check(rowCheckboxes(element)[1], true);
            await flushPromises();
            expect(compareButton(element).textContent).toBe(
                'compare side by side'
            );
        });

        it('puts the log further down the list, the older one, on the left', async () => {
            const element = await createLogList();
            const handleCompare = jest.fn();
            element.addEventListener('comparelogs', handleCompare);
            check(rowCheckboxes(element)[0], true);
            check(rowCheckboxes(element)[1], true);
            await flushPromises();

            click(compareButton(element));

            expect(
                handleCompare.mock.calls[0][0].detail.logs.map(({ id }) => id)
            ).toEqual(['07L2', '07L1']);
        });
    });

    describe('clearing the selection', () => {
        it('offers a clear link only while something is selected', async () => {
            const element = await createLogList();
            expect(clearSelectionButton(element)).toBeNull();

            check(rowCheckboxes(element)[0], true);
            await flushPromises();

            expect(clearSelectionButton(element)).not.toBeNull();
        });

        it('unticks every log from a partial selection', async () => {
            const element = await createLogList();
            check(rowCheckboxes(element)[0], true);
            await flushPromises();

            click(clearSelectionButton(element));
            await flushPromises();

            expect([...rowCheckboxes(element)].some((box) => box.checked)).toBe(
                false
            );
            expect(downloadLabel(element)).toBe('Download all logs');
            expect(clearSelectionButton(element)).toBeNull();
        });

        it('resets the select all checkbox when it clears a partial selection', async () => {
            const element = await createLogList();
            check(rowCheckboxes(element)[0], true);
            await flushPromises();

            click(clearSelectionButton(element));
            await flushPromises();

            expect(selectAllCheckbox(element).checked).toBe(false);
            expect(selectAllCheckbox(element).indeterminate).toBe(false);
        });

        it('unticks every log from a full selection', async () => {
            const element = await createLogList();
            check(selectAllCheckbox(element), true);
            await flushPromises();

            click(clearSelectionButton(element));
            await flushPromises();

            expect([...rowCheckboxes(element)].some((box) => box.checked)).toBe(
                false
            );
            expect(selectAllCheckbox(element).checked).toBe(false);
        });

        it('goes back to downloading the whole list after a reset', async () => {
            const element = await createLogList();
            check(rowCheckboxes(element)[1], true);
            await flushPromises();
            click(clearSelectionButton(element));
            await flushPromises();

            click(downloadAllButton(element));
            await flushPromises();

            expect(downloadLogsComponent(element).logList.length).toBe(2);
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
            expect(
                [...rowCheckboxes(element)].every((box) => box.checked)
            ).toBe(true);
            expect(downloadLabel(element)).toBe('Download selected logs (2)');

            check(selectAllCheckbox(element), false);
            await flushPromises();
            expect([...rowCheckboxes(element)].some((box) => box.checked)).toBe(
                false
            );
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

        it('marks the select all checkbox as indeterminate on a partial selection', async () => {
            const element = await createLogList();

            check(rowCheckboxes(element)[0], true);
            await flushPromises();

            expect(selectAllCheckbox(element).indeterminate).toBe(true);
            expect(selectAllCheckbox(element).checked).toBe(false);
        });

        it('drops the indeterminate mark once every log is ticked', async () => {
            const element = await createLogList();

            check(selectAllCheckbox(element), true);
            await flushPromises();

            expect(selectAllCheckbox(element).indeterminate).toBe(false);
            expect(selectAllCheckbox(element).checked).toBe(true);
        });

        it('ticks the rest of the logs when the select all is used on a partial selection', async () => {
            const element = await createLogList();
            check(rowCheckboxes(element)[0], true);
            await flushPromises();

            check(selectAllCheckbox(element), true);
            await flushPromises();

            expect(downloadLabel(element)).toBe('Download selected logs (2)');
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

    describe('deleting', () => {
        function resolveDeletion(outcome) {
            deleteRecords.mockImplementation((session, ids, options) => {
                if (options && options.onProgress) {
                    options.onProgress(ids.length, ids.length);
                }
                return Promise.resolve(
                    outcome || { deleted: ids, failed: [] }
                );
            });
        }

        beforeEach(() => {
            resolveDeletion();
            confirmDialog.mockImplementation(() => Promise.resolve(true));
        });

        it('renders a delete button on every row and a delete all button', async () => {
            const element = await createLogList();

            expect(rowDeleteButtons(element).length).toBe(2);
            expect(deleteLabel(element)).toBe('Delete all logs');
        });

        it('the trash of a row deletes that log at once without asking', async () => {
            const element = await createLogList();

            click(rowDeleteButtons(element)[0]);
            await flushPromises();
            await flushPromises();

            expect(confirmDialog).not.toHaveBeenCalled();
            expect(deleteRecords).toHaveBeenCalledWith(
                SESSION_INFORMATION,
                ['07L1'],
                expect.any(Object)
            );
            expect(rows(element).length).toBe(1);
            expect(logButtons(element)[0].textContent.trim()).toBe(
                'Jane Roe | log two'
            );
            expect(showToastEvent).toHaveBeenCalledWith(
                'success',
                'Log deleted',
                SESSION_INFORMATION.instanceUrl
            );
        });

        it('delete all asks first and empties the list on yes', async () => {
            const element = await createLogList();

            click(deleteLogsButton(element));
            await flushPromises();
            await flushPromises();

            expect(confirmDialog).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: 'Delete all the logs listed?',
                    confirmLabel: 'Delete 2 logs'
                })
            );
            expect(deleteRecords.mock.calls[0][1]).toEqual(['07L1', '07L2']);
            expect(rows(element).length).toBe(0);
            expect(emptyMessage(element).textContent).toBe(
                'There are no logs in this org'
            );
            expect(showToastEvent).toHaveBeenCalledWith(
                'success',
                '2 logs deleted',
                SESSION_INFORMATION.instanceUrl
            );
        });

        it('deletes nothing when the question is declined', async () => {
            confirmDialog.mockImplementation(() => Promise.resolve(false));
            const element = await createLogList();

            click(deleteLogsButton(element));
            await flushPromises();

            expect(deleteRecords).not.toHaveBeenCalled();
            expect(rows(element).length).toBe(2);
        });

        it('with ticked logs the button carries the count and deletes the selection', async () => {
            const element = await createLogList();
            check(rowCheckboxes(element)[1], true);
            await flushPromises();

            expect(deleteLabel(element)).toBe('Delete selected logs (1)');

            click(deleteLogsButton(element));
            await flushPromises();
            await flushPromises();

            expect(confirmDialog).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: 'Delete the selected logs?',
                    confirmLabel: 'Delete 1 log'
                })
            );
            expect(deleteRecords.mock.calls[0][1]).toEqual(['07L2']);
            expect(rows(element).length).toBe(1);
        });

        it('tells of the deleted logs with an event', async () => {
            const element = await createLogList();
            const deleted = jest.fn();
            element.addEventListener('logsdeleted', deleted);

            click(rowDeleteButtons(element)[1]);
            await flushPromises();
            await flushPromises();

            expect(deleted.mock.calls[0][0].detail).toEqual({ ids: ['07L2'] });
        });

        it('opens the modal when the org refuses every log for want of a permission', async () => {
            resolveDeletion({
                deleted: [],
                failed: [
                    {
                        id: '07L1',
                        message: 'insufficient access rights',
                        errorCode: 'INSUFFICIENT_ACCESS_OR_READONLY'
                    }
                ]
            });
            const element = await createLogList();

            click(rowDeleteButtons(element)[0]);
            await flushPromises();
            await flushPromises();

            expect(alertDialog).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: "You can't delete logs here",
                    message: expect.stringContaining('Modify All Data')
                })
            );
            expect(rows(element).length).toBe(2);
            expect(showToastEvent).not.toHaveBeenCalledWith(
                'error',
                expect.anything(),
                expect.anything()
            );
        });

        it('opens the modal when the call itself comes back forbidden', async () => {
            deleteRecords.mockImplementation(() =>
                Promise.reject(new SalesforceError('Forbidden', 403))
            );
            const element = await createLogList();

            click(deleteLogsButton(element));
            await flushPromises();
            await flushPromises();

            expect(alertDialog).toHaveBeenCalledTimes(1);
            expect(rows(element).length).toBe(2);
        });

        it('keeps a log the org refused for another reason and says so in a toast', async () => {
            resolveDeletion({
                deleted: ['07L1'],
                failed: [
                    {
                        id: '07L2',
                        message: 'entity is locked',
                        errorCode: 'ENTITY_IS_LOCKED'
                    }
                ]
            });
            const element = await createLogList();

            click(deleteLogsButton(element));
            await flushPromises();
            await flushPromises();

            expect(alertDialog).not.toHaveBeenCalled();
            expect(rows(element).length).toBe(1);
            expect(showToastEvent).toHaveBeenCalledWith(
                'error',
                '1 log could not be deleted',
                'entity is locked The other 1 log went.'
            );
        });

        it('a plain failure of the call is a toast, and the list stays', async () => {
            deleteRecords.mockImplementation(() =>
                Promise.reject(new SalesforceError('Server down', 500))
            );
            const element = await createLogList();

            click(rowDeleteButtons(element)[0]);
            await flushPromises();
            await flushPromises();

            expect(showToastEvent).toHaveBeenCalledWith(
                'error',
                'Could not delete the logs',
                'Server down'
            );
            expect(rows(element).length).toBe(2);
        });

        it('shows the deleting bar and hides the actions while the org answers', async () => {
            let answer;
            deleteRecords.mockImplementation(
                () =>
                    new Promise((resolve) => {
                        answer = resolve;
                    })
            );
            const element = await createLogList();

            click(deleteLogsButton(element));
            await flushPromises();
            await flushPromises();

            expect(
                element.shadowRoot.querySelector('.sfdl-delete-process-bar')
            ).not.toBeNull();
            expect(deleteLogsButton(element)).toBeNull();

            answer({ deleted: ['07L1', '07L2'], failed: [] });
            await flushPromises();
            await flushPromises();

            expect(
                element.shadowRoot.querySelector('.sfdl-delete-process-bar')
            ).toBeNull();
        });

        it('refuses a download while a deletion is on the way', async () => {
            deleteRecords.mockImplementation(() => new Promise(() => {}));
            const element = await createLogList();

            click(rowDeleteButtons(element)[0]);
            await flushPromises();
            click(rowDownloadButtons(element)[1]);
            await flushPromises();

            expect(downloadLogsComponent(element)).toBeNull();
            expect(showToastEvent).toHaveBeenCalledWith(
                'info',
                'sfdl',
                'There is a deletion in progress, wait for it to finish.'
            );
        });
    });
});
