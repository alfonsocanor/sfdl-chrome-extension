//The REST plumbing the compare tabs share. Every call takes the session it
//talks to, so a comparison can work against two orgs at the same time.
export const DEFAULT_API_VERSION = '51.0';

export class SalesforceError extends Error {
    constructor(message, status, errorCode){
        super(message);
        this.name = 'SalesforceError';
        this.status = status;
        this.errorCode = errorCode;
    }
}

export function dataApiPath(apiVersion = DEFAULT_API_VERSION, tooling = false){
    return '/services/data/v' + apiVersion + (tooling ? '/tooling' : '');
}

export async function salesforceRequest(sessionInformation, path, options = {}){
    //credentials 'include' sends the cookies of the org along, the streaming
    //api keeps its client on one.
    const { method = 'GET', body, headers = {}, responseType = 'json', signal, credentials } = options;
    const url = /^https?:\/\//.test(path) ? path : sessionInformation.instanceUrl + path;
    let response;

    try{
        response = await fetch(url, {
            method,
            body,
            signal,
            ...(credentials ? { credentials } : {}),
            headers: {
                'Authorization': 'Bearer ' + sessionInformation.authToken,
                'Content-Type': 'application/json; charset=UTF-8',
                ...headers
            }
        });
    } catch(error){
        if(error.name === 'AbortError'){
            throw error;
        }
        throw new SalesforceError('Could not reach ' + sessionInformation.instanceUrl + ': ' + error.message, 0);
    }

    if(response.status < 200 || response.status >= 300){
        throw await createSalesforceError(response, sessionInformation);
    }

    if(responseType === 'text'){
        return response.text();
    }

    return response.status === 204 ? null : response.json();
}

async function createSalesforceError(response, sessionInformation){
    if(response.status === 401){
        return new SalesforceError('Invalid session, log in to ' + sessionInformation.instanceUrl + ' again', 401, 'INVALID_SESSION_ID');
    }

    let message = response.statusText;
    let errorCode;

    //The REST api describes its errors as [{ message, errorCode }].
    try{
        const errorBody = await response.json();
        const error = Array.isArray(errorBody) ? errorBody[0] : errorBody;
        if(error && error.message){
            message = error.message;
            errorCode = error.errorCode;
        }
    } catch(e){
        //Not a json body, the status text is all there is.
    }

    return new SalesforceError(message || 'Error ' + response.status, response.status, errorCode);
}

//Follows nextRecordsUrl until the last batch, the api returns 2000 records at
//most per call and fewer when the records carry long text fields.
export async function queryAll(sessionInformation, soql, { tooling = false, apiVersion = DEFAULT_API_VERSION } = {}){
    let path = dataApiPath(apiVersion, tooling) + '/query/?q=' + encodeURIComponent(soql);
    const records = [];

    while(path){
        //Each batch holds the url of the next one, they cannot run in parallel.
        // eslint-disable-next-line no-await-in-loop
        const result = await salesforceRequest(sessionInformation, path);
        records.push(...result.records);
        path = result.done === false ? result.nextRecordsUrl : null;
    }

    return records;
}

export async function getApiVersions(sessionInformation){
    const versions = await salesforceRequest(sessionInformation, '/services/data/');
    return versions.map(({ version }) => version).sort((a, b) => parseFloat(a) - parseFloat(b));
}

//Comparing two orgs through different api versions would report differences
//that are only the format of each version, so both sides use the newest
//version they have in common.
export async function getCommonApiVersion(...sessions){
    const versionsBySession = await Promise.all(sessions.map(getApiVersions));
    const commonVersions = versionsBySession[0].filter(version =>
        versionsBySession.every(versions => versions.includes(version))
    );

    if(!commonVersions.length){
        throw new SalesforceError('The orgs do not share any api version', 0);
    }

    return commonVersions[commonVersions.length - 1];
}

//The fields the log names are built from, see logName2Display in background.js.
const APEX_LOG_SELECT = 'SELECT Id, LastModifiedDate, LogLength, LogUser.Name, Operation, Status FROM ApexLog ';
const APEX_LOG_ORDER_BY = 'ORDER BY LastModifiedDate DESC';

//The where clause of the header filter replaces the default order, the way
//the analyse log list reads it.
export function getApexLogs(sessionInformation){
    return queryAll(sessionInformation, APEX_LOG_SELECT + (sessionInformation.queryWhere || APEX_LOG_ORDER_BY), { tooling: true });
}

export function getApexLogBody(sessionInformation, apexLog){
    return salesforceRequest(sessionInformation, apexLog.attributes.url + '/Body', { responseType: 'text' });
}

export function describeGlobal(sessionInformation, apiVersion){
    return salesforceRequest(sessionInformation, dataApiPath(apiVersion) + '/sobjects/');
}

export function describeSObject(sessionInformation, sObjectName, apiVersion){
    return salesforceRequest(sessionInformation, dataApiPath(apiVersion) + '/sobjects/' + encodeURIComponent(sObjectName) + '/describe/');
}

//Runs the mapper over the items with at most `limit` calls in flight, so a
//few hundred describes do not hit the org all at once. The results keep the
//order of the items.
export async function mapWithConcurrency(items, limit, mapper){
    const results = new Array(items.length);
    let nextIndex = 0;

    async function worker(){
        while(nextIndex < items.length){
            const index = nextIndex++;
            //Waiting here is the point: it is what keeps the calls in flight capped.
            // eslint-disable-next-line no-await-in-loop
            results[index] = await mapper(items[index], index);
        }
    }

    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));

    return results;
}

//A permission the org refused, as opposed to a record that was not there or
//a session that ran out. The REST api names these two codes for it.
export function isPermissionError(error){
    return !!error && (
        error.status === 403 ||
        /^INSUFFICIENT_ACCESS/.test(error.errorCode || '')
    );
}

//The sObject collections api takes 200 ids at most per call.
const DELETE_CHUNK_SIZE = 200;

//Deletes the records of the ids in chunks, going on past a record the org
//refuses so one of them does not hold the rest back, and reports what went
//through and what did not: { deleted: [id], failed: [{ id, message, errorCode }] }.
//onProgress is told how many ids are settled after each chunk.
export async function deleteRecords(sessionInformation, ids, { apiVersion = DEFAULT_API_VERSION, onProgress } = {}){
    const outcome = { deleted: [], failed: [] };

    for(let start = 0; start < ids.length; start += DELETE_CHUNK_SIZE){
        const chunk = ids.slice(start, start + DELETE_CHUNK_SIZE);
        const path = dataApiPath(apiVersion) + '/composite/sobjects?allOrNone=false&ids=' + chunk.join(',');
        //Each chunk reports before the next one goes, so the progress is honest.
        // eslint-disable-next-line no-await-in-loop
        const results = await salesforceRequest(sessionInformation, path, { method: 'DELETE' });

        results.forEach((result, index) => {
            const id = result.id || chunk[index];

            if(result.success){
                outcome.deleted.push(id);
            } else {
                const [error = {}] = result.errors || [];
                outcome.failed.push({ id, message: error.message || 'Could not delete ' + id, errorCode: error.statusCode });
            }
        });

        if(onProgress){
            onProgress(Math.min(start + chunk.length, ids.length), ids.length);
        }
    }

    return outcome;
}

//The whole deletion failed for want of a permission: either the call itself
//was refused or every record came back refused.
export function isPermissionOutcome(outcome){
    return outcome.deleted.length === 0 &&
        outcome.failed.length > 0 &&
        outcome.failed.every(failure => isPermissionError({ errorCode: failure.errorCode }));
}

export function getLimits(sessionInformation, apiVersion){
    return salesforceRequest(sessionInformation, dataApiPath(apiVersion) + '/limits/');
}

//How many records a query would return, from a SELECT COUNT().
export async function queryCount(sessionInformation, soql, { tooling = false, apiVersion = DEFAULT_API_VERSION } = {}){
    const result = await salesforceRequest(sessionInformation, dataApiPath(apiVersion, tooling) + '/query/?q=' + encodeURIComponent(soql));
    return result.totalSize;
}

//A record id, of 15 or 18 characters. Anything else is kept out of a query.
const RECORD_ID = /^[a-zA-Z0-9]{15}(?:[a-zA-Z0-9]{3})?$/;
//Ids per query, so the url of the query stays short.
const NAME_CHUNK_SIZE = 100;

//The 15 characters an id of 15 or 18 is known by, the way the event log
//files write it.
export function shortId(id){
    return String(id || '').slice(0, 15);
}

//The Name of the records of the ids, as a Map from the short id to the name,
//for the sources that only carry an id: the login history, the event log
//files. An id that is not one, or a record not there, is left out.
export async function getRecordNames(sessionInformation, sObjectName, ids, { apiVersion = DEFAULT_API_VERSION, tooling = false } = {}){
    const unique = [...new Set((ids || []).filter(id => RECORD_ID.test(id || '')).map(shortId))];
    const chunks = [];

    for(let start = 0; start < unique.length; start += NAME_CHUNK_SIZE){
        chunks.push(unique.slice(start, start + NAME_CHUNK_SIZE));
    }

    const batches = await mapWithConcurrency(chunks, 2, chunk =>
        queryAll(sessionInformation, 'SELECT Id, Name FROM ' + sObjectName + " WHERE Id IN ('" + chunk.join("','") + "')", { apiVersion, tooling })
    );
    const names = new Map();

    batches.forEach(records => records.forEach(record => names.set(shortId(record.Id), record.Name)));

    return names;
}

//Changes the fields of one record.
export function updateRecord(sessionInformation, sObjectName, id, fields, { apiVersion = DEFAULT_API_VERSION } = {}){
    return salesforceRequest(sessionInformation,
        dataApiPath(apiVersion) + '/sobjects/' + encodeURIComponent(sObjectName) + '/' + encodeURIComponent(id),
        { method: 'PATCH', body: JSON.stringify(fields) });
}
