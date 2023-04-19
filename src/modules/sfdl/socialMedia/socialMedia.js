import { LightningElement } from 'lwc';

const socialMediaList = [
    {
        title: 'sfdl chrome extension github repository',
        iconTitle:'github logo',
        src: './resources/github.png',
        alt: 'github logo',
        url: 'https://github.com/alfonsocanor'
    },
    {
        title: 'salesforce debug logs vscode extension (sfdl)',
        iconTitle:'vscode logo',
        src: './resources/vscode.png',
        alt: 'vscode logo',
        url: 'https://marketplace.visualstudio.com/items?itemName=sfdl.sfdl'
    }
];
export default class SocialMedia extends LightningElement{
    socialMediaList = socialMediaList;
}