/*global chrome*/
import { LightningElement } from 'lwc';

export default class App extends LightningElement {
    isConsole;
    isPopup;

    connectedCallback(){    
        this.isPopup = window.location.pathname === '/popup.html';
        this.isConsole = !this.isPopup;
        console.log('chrome.devtools' , chrome.devtools);
        //this.init();
    }

    async init(){
        chrome.cookies.getAll({name:'sid', domain:'salesforce.com', secure:true}, (cookies) => {
            console.log('@cookies lengh' + cookies.length);
            cookies.forEach((cookie) => {
                if(cookie.name === 'sid'){
                    console.log(cookie.domain);
                    console.log(cookie.domain);
                    console.log(cookie.value);
                }

            })
        });
    }

    renderedCallback(){
        console.log('chrome.devtools' , chrome.devtools);
        if(chrome.devtools){
            this.getNetworkInformation();
        }
    }

    openSfdlAppInANewTab(){
        chrome.tabs.create({url: 'sfdl.html'});
    }

    getNetworkInformation(){
        chrome.devtools.network.onRequestFinished.addListener(
            function(request) {
              if (request.response.bodySize > 40*1024) {
                chrome.devtools.inspectedWindow.eval(
                    'console.log("Large image: " + unescape("' +
                    escape(request.request.url) + '"))');
              }
            }
        );
    }
}
