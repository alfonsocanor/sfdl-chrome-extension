//Comma separated values, both ways: the event log files of Salesforce come as
//CSV, and any list of the tab can be saved as one. A value holding a comma, a
//quote or a line break is quoted, its quotes doubled.

//The lines of a CSV text, each a list of its values. A quoted value may hold
//commas and line breaks, a doubled quote inside it is one quote.
export function parseCsvLines(text){
    const source = String(text || '').replace(/^\uFEFF/, '');
    const lines = [];
    let line = [];
    let value = '';
    let quoted = false;

    for(let index = 0; index < source.length; index++){
        const char = source[index];

        if(quoted){
            if(char !== '"'){
                value += char;
            } else if(source[index + 1] === '"'){
                value += '"';
                index++;
            } else {
                quoted = false;
            }
        } else if(char === '"'){
            quoted = true;
        } else if(char === ','){
            line.push(value);
            value = '';
        } else if(char === '\n' || char === '\r'){
            if(char === '\r' && source[index + 1] === '\n'){
                index++;
            }
            line.push(value);
            lines.push(line);
            line = [];
            value = '';
        } else {
            value += char;
        }
    }

    if(value || line.length){
        line.push(value);
        lines.push(line);
    }

    return lines;
}

//The rows of a CSV text with a header, each an object keyed by the names of
//the header. A blank line is no row, a value missing at the end of a line
//reads empty.
export function parseCsv(text){
    const [header, ...lines] = parseCsvLines(text);

    if(!header){
        return [];
    }

    return lines
        .filter(line => !(line.length === 1 && line[0] === ''))
        .map(line => {
            const row = {};
            header.forEach((name, index) => {
                row[name] = line[index] === undefined ? '' : line[index];
            });
            return row;
        });
}

function escapeValue(value){
    const text = value === undefined || value === null ? '' : String(value);
    return /[",\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}

//A CSV text out of items, a column per { key, label }: the labels on the
//header, then a line per item with what each key reads off it.
export function toCsv(columns, items){
    return [
        columns.map(column => escapeValue(column.label)).join(','),
        ...items.map(item => columns.map(column => escapeValue(item[column.key])).join(','))
    ].join('\r\n');
}

//Text to paste into a spreadsheet: the labels, then a line per row of texts,
//a tab between them. A tab or a line break inside a text becomes a space.
export function toTsv(labels, rows){
    const clean = value => String(value === undefined || value === null ? '' : value).replace(/[\t\r\n]+/g, ' ');
    return [labels, ...rows].map(line => line.map(clean).join('\t')).join('\n');
}
