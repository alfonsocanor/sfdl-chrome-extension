import {LightningElement, api} from 'lwc';

export default class ProcessBar extends LightningElement{
    progressBarValue = 'width:0%';
    currentValue = 0;
    @api total;
    @api planceholder;

    @api
    updateProgressBar(value){
        this.currentValue = value;
        this.progressBarValue = 'width: ' + this.calculateProgressPercentage(value) + '%';
    }

    calculateProgressPercentage(currentValue){
        return (currentValue / this.total)*100;
    }
}