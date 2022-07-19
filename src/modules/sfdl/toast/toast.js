import { LightningElement, api } from 'lwc';

const SLDS_TOAST_THEME = {
    success: {
        icon:'/slds/icons/utility/success.svg',
        htmlClass: 'slds-theme_success'
    },
    error: {
        icon:'/slds/icons/utility/error.svg',
        htmlClass: 'slds-theme_error'
    },
    warning: {
        icon:'/slds/icons/utility/warning.svg',
        htmlClass: 'slds-theme_warning'
    },
    info: {
        icon:'/slds/icons/utility/info.svg',
        htmlClass: 'slds-theme_info'
    }
}

export default class Toast extends LightningElement{
    @api action;
    @api header;
    @api message;
    showToast = true;
    firstRender = true;
    iconAction;

    renderedCallback(){
        if(this.firstRender){
            let actionSldsHtmlClass = this.determineSldsHtmlClassToApply(this.action);
            this.determineSldsIconAction(this.action);
            this.addSldsHtmlClassThemeNotification(actionSldsHtmlClass);
            this.firstRender = false;
        }
    }

    determineSldsHtmlClassToApply(action){
        return SLDS_TOAST_THEME[action].htmlClass;
    }

    determineSldsIconAction(action){
        this.iconAction = SLDS_TOAST_THEME[action].icon;
    }

    addSldsHtmlClassThemeNotification(actionSldsHtmlClass){
        this.template.querySelector('.slds-notify_toast').classList.add(actionSldsHtmlClass);
    }

    closeToast(){
        this.showToast = false;
    }
}