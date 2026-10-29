import { saveAs } from 'file-saver';
import { queryAll, salesforceRequest, dataApiPath, mapWithConcurrency, describeSObject, DEFAULT_API_VERSION } from 'sfdl/salesforceConnection';
import { parseCsv } from 'sfdl/csv';

//The event log files of Event Monitoring: a CSV per event type and day, or
//per hour where the org has hourly logs, each line one event. Every org gets
//a few types free for a day; the add-on brings the rest for longer.
export const DAILY = 'Daily';
export const HOURLY = 'Hourly';
//Files read at once, so a week of logs does not hit the org all together.
const READ_CONCURRENCY = 2;
const FILE_FIELDS = ['Id', 'EventType', 'LogDate', 'LogFileLength'];
//The fields only an org with the Event Monitoring add-on has: without it
//every file is a daily one, and has no sequence.
const ADD_ON_FIELDS = ['Interval', 'Sequence'];

//The fields of EventLogFile in each org, asked once per org and version.
const fieldsByOrg = new Map();

export function forgetEventLogFields(){
    fieldsByOrg.clear();
}

export function getEventLogFileFields(sessionInformation, apiVersion = DEFAULT_API_VERSION){
    const key = sessionInformation.instanceUrl + '|' + apiVersion;

    if(!fieldsByOrg.has(key)){
        const fields = describeSObject(sessionInformation, 'EventLogFile', apiVersion)
            .then(described => described.fields.map(field => field.name));
        //A describe that failed is asked again next time.
        fields.catch(() => fieldsByOrg.delete(key));
        fieldsByOrg.set(key, fields);
    }

    return fieldsByOrg.get(key);
}

//The files of the last days, the latest first, of one event type and one
//interval when asked, of every one otherwise. An org without intervals has
//daily files only, so it has none to give for hourly.
export async function getEventLogFiles(sessionInformation, { days, eventType, interval, apiVersion = DEFAULT_API_VERSION } = {}){
    const known = await getEventLogFileFields(sessionInformation, apiVersion);
    const hasIntervals = known.includes('Interval');
    const fields = [...FILE_FIELDS, ...ADD_ON_FIELDS.filter(field => known.includes(field))];
    const where = ['LogDate = LAST_N_DAYS:' + days];

    if(interval && !hasIntervals && interval !== DAILY){
        return [];
    }
    if(eventType){
        where.push("EventType = '" + eventType + "'");
    }
    if(interval && hasIntervals){
        where.push("Interval = '" + interval + "'");
    }

    const files = await queryAll(sessionInformation,
        'SELECT ' + fields.join(', ') + ' FROM EventLogFile WHERE ' + where.join(' AND ') + ' ORDER BY LogDate DESC, EventType',
        { apiVersion });

    return files.map(file => ({ ...file, Interval: file.Interval || DAILY }));
}

//The CSV of a file, as text.
export function readEventLogFile(sessionInformation, file, apiVersion = DEFAULT_API_VERSION){
    return salesforceRequest(sessionInformation, dataApiPath(apiVersion) + '/sobjects/EventLogFile/' + file.Id + '/LogFile', { responseType: 'text' });
}

//The files to read out of the ones listed, the latest first: no more than
//maxFiles and no more than maxBytes together. A file too big for what is
//left of the budget is passed over, an older smaller one may still fit.
export function pickWithinBudget(files, { maxFiles, maxBytes }){
    const read = [];
    const skipped = [];
    let bytes = 0;

    files.forEach(file => {
        const size = file.LogFileLength || 0;

        if(read.length < maxFiles && bytes + size <= maxBytes){
            read.push(file);
            bytes += size;
        } else {
            skipped.push(file);
        }
    });

    return { read, skipped };
}

//The events of one type over the last days, out of the files that fit the
//budget, each row keyed by the header of its file and carrying the LogDate
//of its file. Says which files there were, which were read and which not.
export async function readEventLogRows(sessionInformation, { eventType, days, interval = DAILY, maxFiles, maxBytes, apiVersion = DEFAULT_API_VERSION }){
    const files = await getEventLogFiles(sessionInformation, { days, eventType, interval, apiVersion });
    const { read, skipped } = pickWithinBudget(files, { maxFiles, maxBytes });
    const texts = await mapWithConcurrency(read, READ_CONCURRENCY, file => readEventLogFile(sessionInformation, file, apiVersion));
    const rows = [];

    texts.forEach((text, index) => {
        parseCsv(text).forEach(row => {
            row.logDate = read[index].LogDate;
            rows.push(row);
        });
    });

    return { rows, files, read, skipped };
}

//ApiTotalUsage-2026-10-27.csv for a day, -2026-10-27-14 for an hour, with the
//sequence of the file when it has one.
export function eventLogFileName(file){
    const date = String(file.LogDate || '').slice(0, file.Interval === HOURLY ? 13 : 10).replace('T', '-');
    return file.EventType + '-' + date + (file.Sequence ? '-' + file.Sequence : '') + '.csv';
}

//Saves the CSV of a file as it is.
export async function downloadEventLogFile(sessionInformation, file, apiVersion = DEFAULT_API_VERSION){
    const text = await readEventLogFile(sessionInformation, file, apiVersion);
    saveAs(new Blob([text], { type: 'text/csv;charset=utf-8' }), eventLogFileName(file));
}
