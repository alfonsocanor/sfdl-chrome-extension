import { LightningElement, api } from 'lwc';

export default class DeleteAllLogs extends LightningElement{
    deleteIcon = '/slds/icons/utility/delete.svg';
    closeIcon = '/slds/icons/utility/close.svg';
    warningIcon = '/slds/icons/utility/warning.svg';
    isMenuOpen = true;

    @api sessionInformation;

    handleOpenCloseMenu(){
        this.isMenuOpen = !this.isMenuOpen;
        this.addRemoveSldsIsOpenMenuClass(this.isMenuOpen ? 'remove' : 'add');
    }

    addRemoveSldsIsOpenMenuClass(action){
        this.template.querySelector('.sfdlDropdownMenu').classList[action]('slds-is-open');
    }

    async deleteAllLogs(){
        console.log('@sessionInformation: ', this.sessionInformation);
        let response = {}; 
        try{
            response = await fetch(this.sessionInformation.instanceUrl + '/services/async/51.0/job',{
                method:'DELETE',
                headers: {
                    'Authorization': 'Bearer ' + this.sessionInformation.authToken,
                    'Content-type': 'application/json; charset=UTF-8; text/plain',
                },
                body:{
                    "operation" : "hardDelete",
                    "object" : "ApexLog",
                    "contentType" : "JSON"
                }
            });
        
            if(response.status !== 200){
                response.message = response.status === 401 ? response.statusText + ': Invalid session' : response.message;
            }
        } catch(e){
            response.message = e.message;
        }

        console.log('@response: ' , response);
    }
}