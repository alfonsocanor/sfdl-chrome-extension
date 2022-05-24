/*global chrome*/

const getAllCookiesFromSalesforceDomain = async() => { 
    return  chrome.cookies.getAll({name: "sid", domain: "salesforce.com", secure: true});
}

async function isSessionInformationValid(cookie){
    let response;
    try{
        response = await fetch('https://' + cookie.domain + '/services/data/v51.0/tooling/query/?q=SELECT Id FROM ApexLog LIMIT 1',{
            method:'GET',
            headers: {
                'Authorization': 'Bearer ' + cookie.value,
                'Content-type': 'application/json; charset=UTF-8; text/plain',
            }
        });
    } catch (e){
        return false;
    }

    return response.status === 200;
}

export { getAllCookiesFromSalesforceDomain, isSessionInformationValid }
