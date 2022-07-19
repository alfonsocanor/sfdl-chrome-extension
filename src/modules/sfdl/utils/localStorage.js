/* global chrome */

export function clearLocalStorage(){
    chrome.storage.local.clear()
}

export function setKeyValueLocalStorage(key, value){
    chrome.storage.local.set({ [key]: value });
}

export async function getValueLocalStorage(key){
    const result = await chrome.storage.local.get(key);
    return result[key];
}