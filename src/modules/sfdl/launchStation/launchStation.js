/*global chrome*/
import { LightningElement } from 'lwc';
import { css } from './launchStationCss';

export default class App extends LightningElement {
    isConsole;
    isPopup;

    connectedCallback(){    
        this.isPopup = window.location.pathname === '/popup.html';
        this.isConsole = !this.isPopup;

        if(this.isConsole) {
            this.showSfdlLogo();
        }
    }

    showSfdlLogo() {
        this.initializeCustomCss();
        setTimeout(() => {
            let logo = this.template.querySelector('.sfdl-logo');
            if(!logo.classList.contains('fade-out')) {            
                logo.classList.add('fade-out');
                setTimeout(() => {
                    logo.remove();
                }, 1000);
            }
        }, 50);
    }

    initializeCustomCss() { 
        // Check if the custom CSS is already loaded
        if (!document.adoptedStyleSheets.some(sheet => sheet instanceof CSSStyleSheet && sheet.replaceSync === css.replaceSync)) {
            const sheet = new CSSStyleSheet();
            sheet.replaceSync(css);
            document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
        }
    }

    openSfdlAppInANewTab(){
        chrome.tabs.create({url: 'sfdl.html'});
    }
}
