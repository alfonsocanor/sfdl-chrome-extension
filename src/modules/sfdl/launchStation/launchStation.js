/*global chrome*/
import { LightningElement } from 'lwc';

export default class App extends LightningElement {
    isConsole;
    isPopup;

    connectedCallback(){    
        this.isPopup = window.location.pathname === '/popup.html';
        this.isConsole = !this.isPopup;
    }

    openSfdlAppInANewTab(){
        chrome.tabs.create({url: 'sfdl.html'});
    }
}
