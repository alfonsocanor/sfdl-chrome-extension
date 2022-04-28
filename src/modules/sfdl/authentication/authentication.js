/*global chrome*/

const getAllCookiesFromSalesforceDomain = async() => { 
    return  chrome.cookies.getAll({name: "sid", domain: "salesforce.com", secure: true});
}

export { getAllCookiesFromSalesforceDomain }
