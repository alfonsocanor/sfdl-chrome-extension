import { adoptStyleSheet } from 'sfdl/styleSheets';

describe('adoptStyleSheet', () => {
    it('adopts the css into the document', () => {
        const sheet = adoptStyleSheet('.a { color: red; }');

        expect(document.adoptedStyleSheets).toEqual([sheet]);
        expect(sheet.cssText).toBe('.a { color: red; }');
    });

    it('adopts the same css only once', () => {
        adoptStyleSheet('.a { color: red; }');
        adoptStyleSheet('.a { color: red; }');

        expect(document.adoptedStyleSheets).toHaveLength(1);
    });

    it('keeps the sheets other components adopted', () => {
        const first = adoptStyleSheet('.a { color: red; }');
        const second = adoptStyleSheet('.b { color: blue; }');

        expect(document.adoptedStyleSheets).toEqual([first, second]);
    });

    it('adopts the sheet again when the document lost it', () => {
        const sheet = adoptStyleSheet('.a { color: red; }');
        document.adoptedStyleSheets = [];

        expect(adoptStyleSheet('.a { color: red; }')).toBe(sheet);
        expect(document.adoptedStyleSheets).toEqual([sheet]);
    });
});
