import { LightningElement, api } from 'lwc';
import { adoptStyleSheet } from 'sfdl/styleSheets';
import { hasTextSelection, isPressKey } from 'sfdl/utils';
import { adoptCompareTheme } from 'sfdl/compareTheme';
import { css } from './monitorCardCss';

export const LOADING = 'loading';
export const LOADED = 'loaded';
export const FAILED = 'failed';
//The org does not have what the monitor reads, a licence or a permission:
//nothing wrong, nothing to show.
export const UNAVAILABLE = 'unavailable';
export const UNAVAILABLE_LABEL = 'Not in this org';

//The card of a monitor on the Monitoring tab. It knows nothing of what it
//shows: the monitor names it and the state carries the figure. A tile that
//plays a button rather than a button, so its words can be selected and
//copied: a click that ends a selection does not open it.
export default class MonitorCard extends LightningElement{
    //{ key, title, description }, see sfdl/monitors.
    @api monitor;
    //{ status, summary: { value, caption, severity, severityLabel }, error },
    //error being what the org needs when the status is unavailable.
    @api state;

    connectedCallback(){
        adoptStyleSheet(css);
        adoptCompareTheme();
    }

    get title(){
        return this.monitor ? this.monitor.title : '';
    }

    get description(){
        return this.monitor ? this.monitor.description : '';
    }

    get status(){
        return this.state ? this.state.status : LOADING;
    }

    get isLoading(){
        return this.status === LOADING;
    }

    get isLoaded(){
        return this.status === LOADED;
    }

    get isError(){
        return this.status === FAILED;
    }

    get isUnavailable(){
        return this.status === UNAVAILABLE;
    }

    get unavailableLabel(){
        return UNAVAILABLE_LABEL;
    }

    //Only a loaded card has something more to show.
    get isDisabled(){
        return !this.isLoaded;
    }

    get ariaDisabled(){
        return this.isDisabled ? 'true' : 'false';
    }

    get tabIndex(){
        return this.isDisabled ? '-1' : '0';
    }

    get ariaBusy(){
        return this.isLoading ? 'true' : 'false';
    }

    get loadingLabel(){
        return 'Loading ' + this.title;
    }

    get summary(){
        return (this.state && this.state.summary) || {};
    }

    get value(){
        return this.summary.value;
    }

    get caption(){
        return this.summary.caption;
    }

    get severityLabel(){
        return this.summary.severityLabel;
    }

    get error(){
        return this.state ? this.state.error : '';
    }

    get cardClass(){
        if(this.isUnavailable){
            return 'sfdl-monitor-card sfdl-monitor-card_unavailable';
        }
        return 'sfdl-monitor-card' + (this.isLoaded ? ' sfdl-monitor-card_openable sfdl-monitor-card_' + this.summary.severity : '');
    }

    get severityClass(){
        return 'sfdl-monitor-card__severity sfdl-monitor-card__severity_' + this.summary.severity;
    }

    handleOpen(){
        if(this.isLoaded && !hasTextSelection()){
            this.open();
        }
    }

    handleKeyDown(event){
        if(this.isLoaded && isPressKey(event)){
            event.preventDefault();
            this.open();
        }
    }

    open(){
        this.dispatchEvent(new CustomEvent('open', {
            detail: { key: this.monitor.key }
        }));
    }
}
