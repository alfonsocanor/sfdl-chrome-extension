//The components style themselves by adopting a sheet into the document. Each
//css text maps to one CSSStyleSheet, so a component that renders again finds
//its sheet already adopted instead of piling up another copy, and adopting a
//sheet never drops the ones other components adopted before it.
const styleSheets = new Map();

export function adoptStyleSheet(cssText){
    let sheet = styleSheets.get(cssText);

    if(!sheet){
        sheet = new CSSStyleSheet();
        sheet.replaceSync(cssText);
        styleSheets.set(cssText, sheet);
    }

    if(!document.adoptedStyleSheets.includes(sheet)){
        document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
    }

    return sheet;
}
