import { getValueLocalStorage, setKeyValueLocalStorage } from 'sfdl/utils';

const DISMISSED_KEY = 'stepBadgesDismissed';
const listeners = new Set();

//Whether the user closed the numbers of the steps for good. Read from the
//storage of the extension each time, so clearing it brings them back.
export async function areStepBadgesDismissed(){
    try{
        return (await getValueLocalStorage(DISMISSED_KEY)) === true;
    } catch(error){
        return false;
    }
}

//Closed on one picker, they go from every picker on screen and stay gone.
export function dismissStepBadges(){
    setKeyValueLocalStorage(DISMISSED_KEY, true);
    listeners.forEach(listener => listener());
}

export function onStepBadgesDismissed(listener){
    listeners.add(listener);
    return () => listeners.delete(listener);
}
