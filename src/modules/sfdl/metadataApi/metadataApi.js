import JSZip from 'jszip';
import { SalesforceError } from 'sfdl/salesforceConnection';

//The Metadata API only speaks SOAP. The session id the REST calls carry as a
//bearer token is a valid SOAP session id, so the same org session reaches it.
const METADATA_NAMESPACE = 'http://soap.sforce.com/2006/04/metadata';
const POLL_INTERVAL = 2000;
const RETRIEVE_TIMEOUT = 10 * 60 * 1000;
//Like git, a file with a NUL byte in its first bytes is taken for binary.
const BINARY_SNIFF_LENGTH = 8000;

function escapeXml(value){
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function envelope(sessionId, body){
    return '<?xml version="1.0" encoding="UTF-8"?>' +
        '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:met="' + METADATA_NAMESPACE + '">' +
        '<soapenv:Header><met:SessionHeader><met:sessionId>' + escapeXml(sessionId) + '</met:sessionId></met:SessionHeader></soapenv:Header>' +
        '<soapenv:Body>' + body + '</soapenv:Body>' +
        '</soapenv:Envelope>';
}

function childElements(element, localName){
    return [...element.children].filter(child => child.localName === localName);
}

function childText(element, localName){
    const child = childElements(element, localName)[0];
    return child ? child.textContent : undefined;
}

function resultElements(responseDocument){
    return [...responseDocument.getElementsByTagNameNS(METADATA_NAMESPACE, 'result')];
}

export async function metadataCall(sessionInformation, apiVersion, body){
    let response;

    try{
        response = await fetch(sessionInformation.instanceUrl + '/services/Soap/m/' + apiVersion, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/xml; charset=UTF-8',
                'SOAPAction': '""'
            },
            body: envelope(sessionInformation.authToken, body)
        });
    } catch(error){
        throw new SalesforceError('Could not reach ' + sessionInformation.instanceUrl + ': ' + error.message, 0);
    }

    const responseDocument = new DOMParser().parseFromString(await response.text(), 'text/xml');
    const faultString = responseDocument.getElementsByTagName('faultstring')[0];

    //The api answers its errors with a SOAP fault and a 500.
    if(faultString){
        const faultCode = responseDocument.getElementsByTagName('faultcode')[0];
        throw new SalesforceError(
            faultString.textContent,
            response.status,
            faultCode ? faultCode.textContent.replace(/^\w+:/, '') : undefined
        );
    }

    if(response.status !== 200){
        throw new SalesforceError('The Metadata API answered ' + response.status + ' ' + (response.statusText || ''), response.status);
    }

    return responseDocument;
}

//Every component of the given types, { fullName, type, namespacePrefix,
//manageableState, fileName, lastModifiedDate, lastModifiedByName }. The api
//takes three queries per call at most.
export async function listMetadata(sessionInformation, apiVersion, queries){
    const batches = [];
    for(let index = 0; index < queries.length; index += 3){
        batches.push(queries.slice(index, index + 3));
    }

    const documents = await Promise.all(batches.map(batch => metadataCall(sessionInformation, apiVersion,
        '<met:listMetadata>' +
        batch.map(query =>
            '<met:queries>' +
            (query.folder ? '<met:folder>' + escapeXml(query.folder) + '</met:folder>' : '') +
            '<met:type>' + escapeXml(query.type) + '</met:type>' +
            '</met:queries>'
        ).join('') +
        '<met:asOfVersion>' + escapeXml(apiVersion) + '</met:asOfVersion>' +
        '</met:listMetadata>'
    )));

    return documents.flatMap(responseDocument => resultElements(responseDocument).map(result => ({
        fullName: childText(result, 'fullName'),
        type: childText(result, 'type'),
        namespacePrefix: childText(result, 'namespacePrefix') || '',
        manageableState: childText(result, 'manageableState'),
        fileName: childText(result, 'fileName'),
        lastModifiedDate: childText(result, 'lastModifiedDate'),
        lastModifiedByName: childText(result, 'lastModifiedByName')
    })));
}

//types is [{ name, members }], a member can be the * wildcard.
export async function retrieve(sessionInformation, apiVersion, types){
    const responseDocument = await metadataCall(sessionInformation, apiVersion,
        '<met:retrieve><met:retrieveRequest>' +
        '<met:apiVersion>' + escapeXml(apiVersion) + '</met:apiVersion>' +
        '<met:singlePackage>true</met:singlePackage>' +
        '<met:unpackaged>' +
        types.map(type =>
            '<met:types>' +
            type.members.map(member => '<met:members>' + escapeXml(member) + '</met:members>').join('') +
            '<met:name>' + escapeXml(type.name) + '</met:name>' +
            '</met:types>'
        ).join('') +
        '<met:version>' + escapeXml(apiVersion) + '</met:version>' +
        '</met:unpackaged>' +
        '</met:retrieveRequest></met:retrieve>'
    );

    return childText(resultElements(responseDocument)[0], 'id');
}

export async function checkRetrieveStatus(sessionInformation, apiVersion, asyncProcessId){
    const responseDocument = await metadataCall(sessionInformation, apiVersion,
        '<met:checkRetrieveStatus>' +
        '<met:asyncProcessId>' + escapeXml(asyncProcessId) + '</met:asyncProcessId>' +
        '<met:includeZip>true</met:includeZip>' +
        '</met:checkRetrieveStatus>'
    );
    const result = resultElements(responseDocument)[0];

    return {
        done: childText(result, 'done') === 'true',
        status: childText(result, 'status'),
        success: childText(result, 'success') === 'true',
        errorMessage: childText(result, 'errorMessage'),
        zipFile: childText(result, 'zipFile'),
        messages: childElements(result, 'messages').map(message => ({
            fileName: childText(message, 'fileName'),
            problem: childText(message, 'problem')
        }))
    };
}

function abortError(){
    const error = new Error('The retrieve was cancelled');
    error.name = 'AbortError';
    return error;
}

function waitFor(milliseconds, signal){
    return new Promise((resolve, reject) => {
        if(signal && signal.aborted){
            reject(abortError());
            return;
        }

        const timeoutId = setTimeout(resolve, milliseconds);

        if(signal){
            signal.addEventListener('abort', () => {
                clearTimeout(timeoutId);
                reject(abortError());
            }, { once: true });
        }
    });
}

//The files of the zip by path, package.xml left out. A binary file, a static
//resource holding an image for instance, comes as base64 so it can still be
//compared, and is flagged so nobody tries to show it as text.
export async function unzipFiles(zipFileBase64){
    const zip = await JSZip.loadAsync(zipFileBase64, { base64: true });
    const files = new Map();
    const entries = Object.values(zip.files).filter(entry => !entry.dir && entry.name !== 'package.xml');

    await Promise.all(entries.map(async entry => {
        const bytes = await entry.async('uint8array');
        const isBinary = bytes.subarray(0, BINARY_SNIFF_LENGTH).includes(0);

        files.set(entry.name, {
            content: isBinary ? await entry.async('base64') : await entry.async('string'),
            isBinary
        });
    }));

    return files;
}

//Retrieves the types and waits for the org to package them, reporting each
//status it goes through: Pending, InProgress, then Succeeded or Failed.
export async function retrieveFiles(sessionInformation, apiVersion, types, options = {}){
    const { onStatus = () => {}, signal, pollInterval = POLL_INTERVAL, timeout = RETRIEVE_TIMEOUT } = options;
    const asyncProcessId = await retrieve(sessionInformation, apiVersion, types);
    const startedAt = Date.now();

    onStatus('Pending');

    for(;;){
        //The org packages the components in its own time, so the status is
        //asked again and again until it is done.
        // eslint-disable-next-line no-await-in-loop
        await waitFor(pollInterval, signal);
        // eslint-disable-next-line no-await-in-loop
        const retrieveStatus = await checkRetrieveStatus(sessionInformation, apiVersion, asyncProcessId);

        onStatus(retrieveStatus.status);

        if(retrieveStatus.done){
            if(!retrieveStatus.success || retrieveStatus.status === 'Failed'){
                throw new SalesforceError(retrieveStatus.errorMessage || 'The org could not retrieve the metadata', 0);
            }

            return {
                // eslint-disable-next-line no-await-in-loop
                files: retrieveStatus.zipFile ? await unzipFiles(retrieveStatus.zipFile) : new Map(),
                messages: retrieveStatus.messages
            };
        }

        if(Date.now() - startedAt > timeout){
            throw new SalesforceError('The org took too long to retrieve the metadata', 0);
        }
    }
}
