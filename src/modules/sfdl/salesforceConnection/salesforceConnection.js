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
    const { method = 'GET', body, headers = {}, responseType = 'json', signal } = options;
    const url = /^https?:\/\//.test(path) ? path : sessionInformation.instanceUrl + path;
    let response;

    try{
        response = await fetch(url, {
            method,
            body,
            signal,
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
