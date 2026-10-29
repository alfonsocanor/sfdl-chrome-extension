import { LightningElement, api } from 'lwc';
import { adoptStyleSheet } from 'sfdl/styleSheets';
import { css } from './modalCss';

//One dialog for every question and every warning: what it says and what its
//buttons read come in as properties, what the user chose goes out as an
//event. The look of each kind is one entry here.
export const MODAL_VARIANTS = {
    destructive: {
        icon: '/slds/icons/utility/warning.svg',
        iconClass: 'sfdl-modal__icon_warning',
        buttonClass: 'slds-button_destructive'
    },
    error: {
        icon: '/slds/icons/utility/error.svg',
        iconClass: 'sfdl-modal__icon_error',
        buttonClass: 'slds-button_brand'
    },
    info: {
        icon: '/slds/icons/utility/info.svg',
        iconClass: 'sfdl-modal__icon_info',
        buttonClass: 'slds-button_brand'
    }
};

export default class Modal extends LightningElement{
    @api title = '';
    @api message = '';
    @api confirmLabel = 'Confirm';
    //Without a cancel label the dialog only tells, it does not ask.
    @api cancelLabel;
    @api variant = 'info';

    firstRender = true;

    connectedCallback(){
        adoptStyleSheet(css);
    }

    renderedCallback(){
        if(this.firstRender){
            this.firstRender = false;
            const confirmButton = this.template.querySelector('.sfdl-modal__confirm');
            if(confirmButton){
                confirmButton.focus();
            }
        }
    }

    get variantSettings(){
        return MODAL_VARIANTS[this.variant] || MODAL_VARIANTS.info;
    }

    get icon(){
        return this.variantSettings.icon;
    }

    get iconClass(){
        return 'sfdl-modal__icon ' + this.variantSettings.iconClass;
    }

    get confirmClass(){
        return 'slds-button sfdl-modal__confirm ' + this.variantSettings.buttonClass;
    }

    get hasCancel(){
        return !!this.cancelLabel;
    }

    handleConfirm(){
        this.dispatchEvent(new CustomEvent('confirm'));
    }

    handleCancel(){
        //A dialog that only tells closes the same way whatever is clicked.
        this.dispatchEvent(new CustomEvent(this.hasCancel ? 'cancel' : 'confirm'));
    }

    handleKeyDown(event){
        if(event.key === 'Escape'){
            event.preventDefault();
            this.handleCancel();
        }
    }
}
