/*global chrome*/

let totalLogs2Process = 0;
let totalLogsCompletelyRetrieved;
let allLogsDownloaded = [];
const BYTES_SIZE_LIMIT = 22000000;
let fetchAbortController = new AbortController();

const processResponseBasedOnContentType = {
  httpError(response){
    return {hasError: true, error: response.message};
  },
  async contentTypeJson(response){
    const logsInformation = await response.json()
    return logsInformation.records.map(logRecord => logRecord);
  },
  async contentTypeText(response, logId, fileName){
    return {id:logId, name:fileName, response:response.text()};
  }
}

chrome.tabs.onRemoved.addListener(()=>{
  abortFetchOperation();
  applyResetProperties();
  setKeyValueLocalStorage('isDownloadInProgress', false);
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if(request.message === 'downloadApexLog') {
    let apexLogArray = [request.apexLog];

    apexLogArray.every(async apexLog => {
      let completeUrl = request.sessionInformation.instanceUrl + apexLog.attributes.url + '/Body';
      let apexLogWithBody;

      try{
        apexLogWithBody = await getInformationFromSalesforce(completeUrl, { fileName: apexLog.name }, request.sessionInformation, 'contentTypeText', apexLog.id)
      } catch (e){
        console.log('Download operation cancelled!');
      } 

      let logDetail = await apexLogWithBody.response.response;
      apexLogWithBody.response.response = logDetail;

      sendResponse({ apexLogWithBody });
      return true; //Asynchronously.
    });  

    return true; //Asynchronously.
  }

  if(request.message === 'downloadApexLogs'){
    let logList = [];
    totalLogsCompletelyRetrieved = 0;
    totalLogs2Process = request.apexLogList.length;

    request.apexLogList.every(async apexLog => {
      let completeUrl = request.sessionInformation.instanceUrl + apexLog.attributes.url + '/Body';
      let fileName = logName2Display(apexLog);
      let logInformation;
      try{
        logInformation = await getInformationFromSalesforce(completeUrl, { fileName }, request.sessionInformation, 'contentTypeText', apexLog.Id)
      } catch (e){
        console.log('Download operation cancelled!');
      } 

      let logDetail = await logInformation.response.response;
      logInformation.response.response = logDetail;
      logList.push(logInformation.response);
      allLogsDownloaded.push(logInformation.response);
      totalLogsCompletelyRetrieved++;

      if(totalLogs2Process === totalLogsCompletelyRetrieved){
        applyResetProperties();  
        setKeyValueLocalStorage('isDownloadInProgress', false);
        sendResponse({logsDownloaded:true});
      }

      return true;
    });

    return true; //Asynchronously.
  }

  if(request.message === 'downloadProgressBar'){
    sendResponse({totalLogsCompletelyRetrieved});    
    return false; //Synchronously.
  }

  if(request.message === 'getLogsDownloaded'){
    let batchLogs2Process = [];
    for(const index in allLogsDownloaded){
        if(allLogsDownloaded[index]) {
          if(calculateArraySize(batchLogs2Process) > BYTES_SIZE_LIMIT){
            break;
          }

          batchLogs2Process.push(allLogsDownloaded[index]);
        }
    }

    allLogsDownloaded = allApexLogListProcessed(allLogsDownloaded, batchLogs2Process);

    let continueProcess = allLogsDownloaded.length > 0;
    
    sendResponse({batchLogs2Process, continueProcess});
    return false; //Synchronously.
  }

  if(request.message === 'getApexLogList'){
    let apexLogList = getApexLogList(request.apexLogList);

    sendResponse({ apexLogList });
    return false; //Synchronously.
  }

  return false; //Synchronously.
});

function calculateArraySize(array){
  return new Blob([JSON.stringify(array)]).size;
}

function allApexLogListProcessed(apexLogList, logsProcessed){
  let logIdsList = logsProcessed.map(log => log.id);
  return apexLogList.filter( log => !logIdsList.includes(log.id));
}

function applyResetProperties(){
  totalLogsCompletelyRetrieved = 0;
  totalLogs2Process = 0;
}

function abortFetchOperation(){
  fetchAbortController.abort();
  fetchAbortController = new AbortController();
}

async function getInformationFromSalesforce(requestUrl, additionalOutputs, sessionInformation, function2Execute, logId) {
  const response = await fetchLogsRecords(requestUrl,sessionInformation, function2Execute, logId, additionalOutputs.fileName);
  return {response, additionalOutputs};
}

async function fetchLogsRecords(requestUrl, sessionInformation, function2Execute, logId, fileName){
  let response = {}; 
  try{
    response = await fetch(requestUrl,{
      method:'GET',
      headers: {
        'Authorization': 'Bearer ' + sessionInformation.authToken,
        'Content-type': 'application/json; charset=UTF-8; text/plain',
      },
      signal: fetchAbortController.signal
    });

    if(response.status !== 200){
      function2Execute = 'httpError';
      response.message = response.status === 401 ? response.statusText + ': Invalid session' : response.message;
    }
  } catch(e){
    function2Execute = 'httpError';
    response.message = e.message;
  }
  return processResponseBasedOnContentType[function2Execute](response, logId, fileName);
}

function getApexLogList(apexLogList) {
  let logList = [];
  for(apexLog in apexLogList) {
    logList.push(
      {
        id: apexLogList[apexLog].Id,
        name: logName2Display(apexLogList[apexLog]),
        attributes: apexLogList[apexLog].attributes,
        response: ''
      }
    )
  }

  return logList;
}

function logName2Display(apexLog){
  return  apexLog.LogUser.Name + ' | ' + 
          createOperationFormat(apexLog.Operation) + ' | ' +
          apexLog.LogLength + 'bytes | ' +
          createDatetimeFormat(new Date(apexLog.LastModifiedDate)) + ' | ' +
          apexLog.Status;
}

function createOperationFormat(operation){
  let regex = new RegExp('/', 'g');

  if(operation.includes('__')){
    return operation.replace(regex, '').split('__')[1];
  }

  return operation.replace(regex, '');
}

function createDatetimeFormat(date){
  return  padNumberValues(date.getDay(), 2,'0') + '/' +
          padNumberValues(date.getMonth(), 2, '0') + ' ' +
          padNumberValues(date.getHours(), 2, '0') + 'h' + 
          padNumberValues(date.getMinutes(), 2, '0') + 'm' +
          padNumberValues(date.getSeconds(), 2, '0') + 's';
}

function padNumberValues(numberValue, padLength, padString){
  return numberValue.toString().padStart(padLength, padString);
}

function setKeyValueLocalStorage(key, value){
  chrome.storage.local.set({ [key]: value });
}