import { createElement } from 'lwc';
import CompareLogList from 'sfdl/compareLogList';

const ACME = {
    instanceUrl: 'https://acme.my.salesforce.com',
    authToken: 'sid-acme',
    queryWhere: ''
};
const GLOBEX = {
    instanceUrl: 'https://globex.my.salesforce.com',
    authToken: 'sid-globex'
};

const LOGS = [
    {
        id: '07L1',
        name: 'John Doe | ApexTesting | 1024bytes | 17/10 10h20m30s | Success',
        attributes: { url: '/l/07L1' }
    },
    {
        id: '07L2',
        name: 'Jane Roe | Api | 2048bytes | 17/10 10h21m00s | Success',
        attributes: { url: '/l/07L2' }
    },
    {
        id: '07L3',
        name: 'John Doe | Batch | 4096bytes | 16/10 09h00m00s | Assertion Failed',
        attributes: { url: '/l/07L3' }
    }
];

function wait(milliseconds = 0) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function mockOrgLogs(logs = LOGS) {
    global.fetch = jest.fn(() =>
        Promise.resolve({
            status: 200,
            json: () =>
                Promise.resolve({
                    done: true,
                    records: logs.map((log) => ({ Id: log.id }))
                })
        })
    );
    chrome.runtime.sendMessage.mockImplementation(() =>
        Promise.resolve({ apexLogList: logs })
    );
}

async function createLogList(properties = {}) {
    const element = createElement('sfdl-compare-log-list', {
        is: CompareLogList
    });
    Object.assign(element, { sessionInformation: ACME, ...properties });
    document.body.appendChild(element);
    await wait();
    await wait();
    return element;
}

const rows = (element) => [
    ...element.shadowRoot.querySelectorAll('.sfdl-compare-log-row')
];
const names = (element) =>
    [...element.shadowRoot.querySelectorAll('.sfdl-compare-log-name')].map(
        (button) => button.textContent.trim()
    );
const message = (element) =>
    element.shadowRoot.querySelector('.sfdl-compare-log-list__message');
const count = (element) =>
    element.shadowRoot.querySelector('.sfdl-compare-log-list__count');
const filter = (element) =>
    element.shadowRoot.querySelector('.sfdl-compare-log-filter');

function click(node) {
    node.dispatchEvent(new CustomEvent('click'));
}

function type(node, value) {
    node.value = value;
    node.dispatchEvent(new CustomEvent('input'));
}

function pressKey(node, key) {
    const event = new CustomEvent('keydown', { cancelable: true });
    event.key = key;
    node.dispatchEvent(event);
}

describe('sfdl-compare-log-list', () => {
    beforeEach(() => {
        mockOrgLogs();
    });

    describe('loading', () => {
        it('lists the logs of the org, newest first', async () => {
            const element = await createLogList();

            expect(names(element)).toEqual(LOGS.map((log) => log.name));
            expect(count(element).textContent).toBe('3 logs');
            expect(decodeURIComponent(fetch.mock.calls[0][0])).toContain(
                'FROM ApexLog ORDER BY LastModifiedDate DESC'
            );
            expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
                message: 'getApexLogList',
                apexLogList: LOGS.map((log) => ({ Id: log.id }))
            });
        });

        it('outlines its rows in place of the list while it loads', async () => {
            let answer;
            chrome.runtime.sendMessage.mockImplementation(
                () =>
                    new Promise((resolve) => {
                        answer = resolve;
                    })
            );
            const element = await createLogList({ side: 'both' });

            const stencil = element.shadowRoot.querySelector(
                'sfdl-loading-stencil'
            );
            expect(stencil.type).toBe('compareLogList');
            expect(stencil.ticks).toBe(true);
            expect(count(element)).toBeNull();

            answer({ apexLogList: LOGS });
            await wait();

            expect(
                element.shadowRoot.querySelector('sfdl-loading-stencil')
            ).toBeNull();
            expect(names(element)).toEqual(LOGS.map((log) => log.name));
        });

        it('applies the where clause of the header filter', async () => {
            await createLogList({
                sessionInformation: {
                    ...ACME,
                    queryWhere: "WHERE Status = 'Success'"
                }
            });

            expect(decodeURIComponent(fetch.mock.calls[0][0])).toContain(
                "FROM ApexLog WHERE Status = 'Success'"
            );
        });

        it('asks for an org while it has none', async () => {
            const element = await createLogList({
                sessionInformation: undefined,
                noSessionMessage: 'Pick the right org'
            });

            expect(message(element).textContent).toBe('Pick the right org');
            expect(fetch).not.toHaveBeenCalled();
        });

        it('says when the org has no logs', async () => {
            mockOrgLogs([]);

            const element = await createLogList();

            expect(message(element).textContent).toBe(
                'There are no logs in this org'
            );
        });

        it('shows why the logs could not be queried', async () => {
            global.fetch = jest.fn(() =>
                Promise.resolve({
                    status: 401,
                    json: () => Promise.resolve({})
                })
            );

            const element = await createLogList();

            expect(message(element).textContent).toContain('Invalid session');
            expect(
                message(element).classList.contains(
                    'sfdl-compare-log-list__message_error'
                )
            ).toBe(true);
        });

        it('loads the logs again when the org changes', async () => {
            const element = await createLogList();

            element.sessionInformation = GLOBEX;
            await wait();
            await wait();

            expect(fetch).toHaveBeenCalledTimes(2);
            expect(fetch.mock.calls[1][0]).toContain(
                'globex.my.salesforce.com'
            );
        });

        it('keeps its logs when it is handed the same org again', async () => {
            const element = await createLogList();

            element.sessionInformation = { ...ACME };
            await wait();

            expect(fetch).toHaveBeenCalledTimes(1);
        });

        it('keeps the logs of the latest org when an older answer comes late', async () => {
            const slowLogs = [{ id: '07LS', name: 'slow org log' }];
            chrome.runtime.sendMessage.mockImplementationOnce(
                () =>
                    new Promise((resolve) =>
                        setTimeout(() => resolve({ apexLogList: slowLogs }), 30)
                    )
            );
            const element = await createLogList();

            element.sessionInformation = GLOBEX;
            await wait(50);

            expect(names(element)).toEqual(LOGS.map((log) => log.name));
        });

        it('queries the logs again on refresh', async () => {
            const element = await createLogList();

            click(
                element.shadowRoot.querySelector('.sfdl-compare-log-refresh')
            );
            await wait();
            await wait();

            expect(fetch).toHaveBeenCalledTimes(2);
        });
    });

    describe('filtering', () => {
        it('keeps the logs that hold every word typed, in any case', async () => {
            const element = await createLogList();

            type(filter(element), 'john  SUCCESS');
            await wait();

            expect(names(element)).toEqual([LOGS[0].name]);
            expect(count(element).textContent).toBe('1 of 3 logs');
        });

        it('says when nothing matches', async () => {
            const element = await createLogList();

            type(filter(element), 'nobody');
            await wait();

            expect(rows(element)).toHaveLength(0);
            expect(message(element).textContent).toBe(
                'No log matches the filter'
            );
        });
    });

    describe('picking', () => {
        it('sends a clicked log to its own side', async () => {
            const element = await createLogList({ side: 'right' });
            const handleSelect = jest.fn();
            element.addEventListener('logselect', handleSelect);

            click(
                element.shadowRoot.querySelectorAll('.sfdl-compare-log-name')[1]
            );

            expect(handleSelect.mock.calls[0][0].detail).toEqual({
                log: LOGS[1],
                side: 'right'
            });
        });

        it('tints the selected log in the colour of its side', async () => {
            const element = await createLogList({
                side: 'right',
                rightLogId: '07L2'
            });

            expect(
                rows(element).map((row) =>
                    row.classList.contains('sfdl-compare-log-row_right')
                )
            ).toEqual([false, true, false]);
        });

        it('compares every log the arrows walk on', async () => {
            const element = await createLogList({ side: 'left' });
            const handleSelect = jest.fn();
            element.addEventListener('logselect', handleSelect);
            const logButtons = element.shadowRoot.querySelectorAll(
                '.sfdl-compare-log-name'
            );

            pressKey(logButtons[0], 'ArrowDown');
            pressKey(logButtons[0], 'ArrowUp');

            expect(
                handleSelect.mock.calls.map(([event]) => event.detail.log.id)
            ).toEqual(['07L2', '07L3']);
        });
    });

    describe('feeding both sides', () => {
        const ticks = (element) => [
            ...element.shadowRoot.querySelectorAll('.sfdl-compare-log-tick')
        ];

        it('ticks the two logs compared, each in the colour of its side', async () => {
            const element = await createLogList({
                side: 'both',
                leftLogId: '07L1',
                rightLogId: '07L3'
            });

            expect(ticks(element).map((tick) => tick.checked)).toEqual([
                true,
                false,
                true
            ]);
            expect(
                rows(element).map((row) =>
                    row.classList.contains('sfdl-compare-log-row_left')
                        ? 'left'
                        : row.classList.contains('sfdl-compare-log-row_right')
                          ? 'right'
                          : ''
                )
            ).toEqual(['left', '', 'right']);
        });

        it('has no ticks feeding one side', async () => {
            const element = await createLogList({ side: 'left' });

            expect(ticks(element)).toHaveLength(0);
        });

        it('leaves the side of a log ticked or clicked to the comparison', async () => {
            const element = await createLogList({ side: 'both' });
            const handleSelect = jest.fn();
            element.addEventListener('logselect', handleSelect);

            click(ticks(element)[1]);
            click(element.shadowRoot.querySelectorAll('.sfdl-compare-log-name')[2]);

            expect(
                handleSelect.mock.calls.map(([event]) => event.detail)
            ).toEqual([
                { log: LOGS[1], side: undefined },
                { log: LOGS[2], side: undefined }
            ]);
        });

        it('walks past a ticked log with the arrows, it is the one compared against', async () => {
            const element = await createLogList({
                side: 'both',
                leftLogId: '07L2'
            });
            const handleSelect = jest.fn();
            element.addEventListener('logselect', handleSelect);
            const logButtons = element.shadowRoot.querySelectorAll(
                '.sfdl-compare-log-name'
            );

            pressKey(logButtons[0], 'ArrowDown');
            pressKey(logButtons[1], 'ArrowDown');

            expect(
                handleSelect.mock.calls.map(([event]) => event.detail.log.id)
            ).toEqual(['07L3']);
        });
    });
});
