import { LightningElement } from 'lwc';

const sfdlPage = [
    {
        title: 'sfdl chrome extension github repository',
        iconTitle:'sfdl logo',
        src: './resources/sfdl.png',
        alt: 'sfdl logo',
        url: 'https://salesforce.omltt.net/sfdl'
    }
];
export default class Footer extends LightningElement{
    sfdlPage = sfdlPage;
}