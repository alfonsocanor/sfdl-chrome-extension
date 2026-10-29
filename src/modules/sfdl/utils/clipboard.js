//Copying, and telling a click from the end of a text being selected, so a
//clickable tile can still have its words copied.

//Puts the text on the clipboard. Where the clipboard api is not open to the
//page, a hidden text area is selected and copied the old way.
export async function copyText(text){
    if(navigator.clipboard && navigator.clipboard.writeText){
        try{
            await navigator.clipboard.writeText(text);
            return;
        } catch(error){
            //Refused, the old way below.
        }
    }

    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    try{
        document.execCommand('copy');
    } finally {
        area.remove();
    }
}

//True while some text is selected on the page: the click that ends a drag
//over a tile is a selection, not a click on the tile.
export function hasTextSelection(){
    const selection = window.getSelection ? window.getSelection() : null;
    return !!selection && !selection.isCollapsed && String(selection).trim().length > 0;
}

//Enter and the space bar press what plays the part of a button.
export function isPressKey(event){
    return event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar';
}
