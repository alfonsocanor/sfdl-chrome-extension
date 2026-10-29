import {
    getEventLogFiles,
    readEventLogFile,
    readEventLogRows,
    pickWithinBudget,
    eventLogFileName,
    downloadEventLogFile,
    forgetEventLogFields
} from 'sfdl/eventLogFiles';
import { queryAll, salesforceRequest, describeSObject } from 'sfdl/salesforceConnection';
import { saveAs } from 'file-saver';

jest.mock('file-saver', () => ({ saveAs: jest.fn() }));
jest.mock('sfdl/salesforceConnection', () =>
    Object.assign({}, jest.requireActual('sfdl/salesforceConnection'), {
        queryAll: jest.fn(),
        salesforceRequest: jest.fn(),
        describeSObject: jest.fn()
    })
);

const ACME = { instanceUrl: 'https://acme.my.salesforce.com', authToken: 'sid-acme' };
const fieldsOf = (...names) => ({ fields: names.map((name) => ({ name })) });
const ADD_ON = fieldsOf('Id', 'EventType', 'LogDate', 'LogFileLength', 'Interval', 'Sequence');
const FREE = fieldsOf('Id', 'EventType', 'LogDate', 'LogFileLength', 'LogFileContentType');
const file = (id, logDate, size, extra = {}) => ({ Id: id, EventType: 'ApiTotalUsage', LogDate: logDate, Interval: 'Daily', LogFileLength: size, Sequence: 0, ...extra });

describe('eventLogFiles', () => {
    beforeEach(() => {
        queryAll.mockReset();
        salesforceRequest.mockReset();
        saveAs.mockReset();
        describeSObject.mockReset();
        describeSObject.mockResolvedValue(ADD_ON);
        forgetEventLogFields();
    });

    it('lists the files of the last days, of a type and an interval when asked', async () => {
        queryAll.mockResolvedValue([]);

        await getEventLogFiles(ACME, { days: 7, eventType: 'ApiTotalUsage', interval: 'Daily', apiVersion: '60.0' });
        await getEventLogFiles(ACME, { days: 3, apiVersion: '60.0' });

        expect(queryAll.mock.calls[0][1]).toBe(
            "SELECT Id, EventType, LogDate, LogFileLength, Interval, Sequence FROM EventLogFile WHERE LogDate = LAST_N_DAYS:7 AND EventType = 'ApiTotalUsage' AND Interval = 'Daily' ORDER BY LogDate DESC, EventType"
        );
        expect(queryAll.mock.calls[0][2]).toEqual({ apiVersion: '60.0' });
        expect(queryAll.mock.calls[1][1]).toContain('WHERE LogDate = LAST_N_DAYS:3 ORDER BY');
        expect(describeSObject).toHaveBeenCalledTimes(1);
        expect(describeSObject).toHaveBeenCalledWith(ACME, 'EventLogFile', '60.0');
    });

    it('asks an org without the add-on only for the fields it has, every file a daily one', async () => {
        describeSObject.mockResolvedValue(FREE);
        queryAll.mockResolvedValue([{ Id: '0AT1', EventType: 'Login', LogDate: '2026-10-27T00:00:00.000+0000', LogFileLength: 10 }]);

        const files = await getEventLogFiles(ACME, { days: 7, eventType: 'Login', interval: 'Daily' });

        expect(queryAll.mock.calls[0][1]).toBe(
            "SELECT Id, EventType, LogDate, LogFileLength FROM EventLogFile WHERE LogDate = LAST_N_DAYS:7 AND EventType = 'Login' ORDER BY LogDate DESC, EventType"
        );
        expect(files[0].Interval).toBe('Daily');
        expect(await getEventLogFiles(ACME, { days: 7, interval: 'Hourly' })).toEqual([]);
        expect(queryAll).toHaveBeenCalledTimes(1);
    });

    it('asks again for the fields of an org whose describe failed', async () => {
        describeSObject.mockRejectedValueOnce(Object.assign(new Error('No access'), { errorCode: 'INSUFFICIENT_ACCESS' }));
        queryAll.mockResolvedValue([]);

        await expect(getEventLogFiles(ACME, { days: 7 })).rejects.toThrow('No access');
        await getEventLogFiles(ACME, { days: 7 });

        expect(describeSObject).toHaveBeenCalledTimes(2);
    });

    it('reads the CSV of a file as text', async () => {
        salesforceRequest.mockResolvedValue('A\n1');

        expect(await readEventLogFile(ACME, { Id: '0AT1' }, '60.0')).toBe('A\n1');
        expect(salesforceRequest).toHaveBeenCalledWith(ACME, '/services/data/v60.0/sobjects/EventLogFile/0AT1/LogFile', { responseType: 'text' });
    });

    it('picks the latest files within the number and the bytes allowed', () => {
        const files = [file('a', '2026-10-27', 40), file('b', '2026-10-26', 80), file('c', '2026-10-25', 50), file('d', '2026-10-24', 5)];

        const { read, skipped } = pickWithinBudget(files, { maxFiles: 2, maxBytes: 100 });

        expect(read.map((each) => each.Id)).toEqual(['a', 'c']);
        expect(skipped.map((each) => each.Id)).toEqual(['b', 'd']);
    });

    it('reads the rows of the files that fit, each with the day of its file', async () => {
        queryAll.mockResolvedValue([file('a', '2026-10-27T00:00:00.000+0000', 10), file('b', '2026-10-26T00:00:00.000+0000', 10)]);
        salesforceRequest.mockImplementation((session, path) =>
            Promise.resolve(path.includes('/a/') ? 'USER_ID,CALLS\n005A,1\n005B,2' : 'USER_ID,CALLS\n005A,3'));

        const loaded = await readEventLogRows(ACME, { eventType: 'ApiTotalUsage', days: 7, maxFiles: 7, maxBytes: 1000, apiVersion: '60.0' });

        expect(queryAll.mock.calls[0][1]).toContain("EventType = 'ApiTotalUsage' AND Interval = 'Daily'");
        expect(loaded.rows).toEqual([
            { USER_ID: '005A', CALLS: '1', logDate: '2026-10-27T00:00:00.000+0000' },
            { USER_ID: '005B', CALLS: '2', logDate: '2026-10-27T00:00:00.000+0000' },
            { USER_ID: '005A', CALLS: '3', logDate: '2026-10-26T00:00:00.000+0000' }
        ]);
        expect(loaded.files.length).toBe(2);
        expect(loaded.read.length).toBe(2);
        expect(loaded.skipped).toEqual([]);
    });

    it('names a file after its type, its day or hour and its sequence', () => {
        expect(eventLogFileName(file('a', '2026-10-27T00:00:00.000+0000', 1))).toBe('ApiTotalUsage-2026-10-27.csv');
        expect(eventLogFileName(file('a', '2026-10-27T14:00:00.000+0000', 1, { Interval: 'Hourly', Sequence: 2 }))).toBe('ApiTotalUsage-2026-10-27-14-2.csv');
    });

    it('saves the CSV of a file as it is', async () => {
        salesforceRequest.mockResolvedValue('A\n1');

        await downloadEventLogFile(ACME, file('a', '2026-10-27T00:00:00.000+0000', 1));

        expect(saveAs).toHaveBeenCalledWith(expect.any(Blob), 'ApiTotalUsage-2026-10-27.csv');
    });
});
