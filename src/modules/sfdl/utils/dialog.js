import { createElement } from 'lwc';
import SfdlModal from 'sfdl/modal';

//The dialog open, if any: one at a time, a new one takes its place.
let openModal;

//Opens the dialog over the page and settles with what the user chose, true for
//the confirm button and false for cancel, Escape or the backdrop.
export function openDialog({ title, message, confirmLabel, cancelLabel, variant }){
    closeDialogs();

    return new Promise(resolve => {
        const modal = createElement('sfdl-modal', { is: SfdlModal });
        openModal = modal;
        modal.title = title;
        modal.message = message;
        modal.variant = variant;
        if(confirmLabel){
            modal.confirmLabel = confirmLabel;
        }
        modal.cancelLabel = cancelLabel;

        const settle = choice => {
            modal.remove();
            if(openModal === modal){
                openModal = undefined;
            }
            resolve(choice);
        };
        modal.addEventListener('confirm', () => settle(true));
        modal.addEventListener('cancel', () => settle(false));

        document.body.appendChild(modal);
    });
}

//A question with a way out, for what cannot be undone.
export function confirmDialog({ title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', variant = 'destructive' }){
    return openDialog({ title, message, confirmLabel, cancelLabel, variant });
}

//Something the user has to read, with one button to close it.
export function alertDialog({ title, message, closeLabel = 'Close', variant = 'error' }){
    return openDialog({ title, message, confirmLabel: closeLabel, variant });
}

export function closeDialogs(){
    if(openModal){
        openModal.remove();
        openModal = undefined;
    }
}
