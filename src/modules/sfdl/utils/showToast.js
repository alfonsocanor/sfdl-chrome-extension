import { createElement } from 'lwc';
import SfdlToast from 'sfdl/toast';

let toastCloseSetTimeoutId;

export function showToastEvent(action, header, message, timeInMilliseconds){
    clearToastCloseSetTimeout();
    removeAllToastEventsFromDOM();
    createToastComponent(action, header, message);
    removeToastEventFromDOM(timeInMilliseconds ? timeInMilliseconds : 3000);
}

function createToastComponent(action, header, message){
    const toast = createElement('sfdl-toast', { is: SfdlToast });
    toast.action = action;
    toast.header = header;
    toast.message = message;

    document.body.appendChild(toast);
}

function removeAllToastEventsFromDOM(){
    const allToastComponent = document.querySelectorAll('sfdl-toast');

    allToastComponent.forEach(toast => {
        toast.remove();
    });
}

function removeToastEventFromDOM(timeInMilliseconds){
    toastCloseSetTimeoutId = setTimeout(() => {  
        const toast = document.querySelector('sfdl-toast');  
        toast.finalizeAnimation();
        setTimeout(() => {  
            toast.remove();
        },1000);
    }, timeInMilliseconds);
}

function clearToastCloseSetTimeout(){
    window.clearTimeout(toastCloseSetTimeoutId);
}