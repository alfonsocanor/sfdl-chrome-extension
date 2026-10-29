import { parseCsv, parseCsvLines, toCsv } from 'sfdl/csv';

describe('csv', () => {
    it('reads the rows of a CSV under its header', () => {
        const text = '"EVENT_TYPE","USER_ID","COUNT"\n"ApiTotalUsage","005A",3\r\n"ApiTotalUsage","005B",\n';

        expect(parseCsv(text)).toEqual([
            { EVENT_TYPE: 'ApiTotalUsage', USER_ID: '005A', COUNT: '3' },
            { EVENT_TYPE: 'ApiTotalUsage', USER_ID: '005B', COUNT: '' }
        ]);
    });

    it('keeps commas, doubled quotes and line breaks inside a quoted value', () => {
        expect(parseCsvLines('A,B\n"one, two","say ""hi""\nagain"')).toEqual([
            ['A', 'B'],
            ['one, two', 'say "hi"\nagain']
        ]);
    });

    it('drops the byte order mark, blank lines and reads nothing out of nothing', () => {
        expect(parseCsv('\uFEFFA\n1\n\n2')).toEqual([{ A: '1' }, { A: '2' }]);
        expect(parseCsv('')).toEqual([]);
        expect(parseCsv(undefined)).toEqual([]);
        expect(parseCsv('A,B')).toEqual([]);
    });

    it('writes the labels then a line per item, quoting what needs it', () => {
        const columns = [{ key: 'name', label: 'Name' }, { key: 'note', label: 'Note, long' }, { key: 'count', label: 'Count' }];

        expect(toCsv(columns, [
            { name: 'Ann', note: 'said "no"', count: 2 },
            { name: 'Bob', note: 'two\nlines', count: null }
        ])).toBe('Name,"Note, long",Count\r\nAnn,"said ""no""",2\r\nBob,"two\nlines",');
    });

    it('reads back what it writes', () => {
        const columns = [{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }];
        const items = [{ a: 'x,y', b: 'q"z' }];

        expect(parseCsv(toCsv(columns, items))).toEqual([{ A: 'x,y', B: 'q"z' }]);
    });
});
