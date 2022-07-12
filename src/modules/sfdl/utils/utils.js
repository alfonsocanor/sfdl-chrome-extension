import { createElement } from 'lwc';
import SfdlToast from 'sfdl/toast';

export function showToastEvent(action, header, message){
    const toast = createElement('sfdl-toast', { is: SfdlToast });
    toast.action = action;
    toast.header = header;
    toast.message = message;

    document.body.appendChild(toast);

    removeToastEventFromDOM();
}

function removeToastEventFromDOM(){
    setTimeout(() => {    
        const toastComponent = document.querySelector('sfdl-toast');
        toastComponent.remove();
    }, 3000);
}