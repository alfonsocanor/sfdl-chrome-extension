const APEX_LOG_IDS_QUERY_URL = '/services/data/v51.0/tooling/query/?q=';
const APEX_LOG_IDS_QUERY_URL_SELECT_FROM = 'SELECT Id, LastModifiedDate, LogLength, LogUser.Name, Operation FROM ApexLog ';
const APEX_LOG_IDS_QUERY_URL_ORDER_BY = ' ORDER BY LastModifiedDate DESC';

async function getSalesforceApexLogIds(sessionInformation){
    let url2GetApexLogIds = sessionInformation.instanceUrl +
    APEX_LOG_IDS_QUERY_URL + APEX_LOG_IDS_QUERY_URL_SELECT_FROM +
        (sessionInformation.queryWhere ? sessionInformation.queryWhere : APEX_LOG_IDS_QUERY_URL_ORDER_BY);
    const apexLogIdList = await this.getInformationFromSalesforce(url2GetApexLogIds, {}, sessionInformation, 'contentTypeJson');
    return apexLogIdList;
}
        
export { getSalesforceLogIds }