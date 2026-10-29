//A search that forgives a mistyped word: 'dta', 'strage' and 'estorage' all
//find 'Data storage'. Every word typed has to match a word of the texts
//searched, by its start, by its letters in order, or by being one or two
//letters off, depending on how long it is. Not a ranking, a yes or no.

//Lower case, letters and digits only, the words apart. A camel cased name
//comes apart at its capitals: 'DataStorageMB' reads 'data storage mb'.
export function wordsOf(text){
    return String(text || '')
        .replace(/([a-z\d])([A-Z])/g, '$1 $2')
        .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
        .toLowerCase()
        .split(/[^a-z\d]+/)
        .filter(Boolean);
}

//How many edits turn one word into the other, an edit being a letter put
//in, taken out, changed or swapped with its neighbour.
export function editDistance(a, b){
    const rows = a.length + 1;
    const columns = b.length + 1;
    const distance = Array.from({ length: rows }, (unused, row) => {
        const line = new Array(columns).fill(0);
        line[0] = row;
        return line;
    });

    for(let column = 0; column < columns; column++){
        distance[0][column] = column;
    }

    for(let row = 1; row < rows; row++){
        for(let column = 1; column < columns; column++){
            const cost = a[row - 1] === b[column - 1] ? 0 : 1;
            distance[row][column] = Math.min(
                distance[row - 1][column] + 1,
                distance[row][column - 1] + 1,
                distance[row - 1][column - 1] + cost
            );
            if(row > 1 && column > 1 && a[row - 1] === b[column - 2] && a[row - 2] === b[column - 1]){
                distance[row][column] = Math.min(distance[row][column], distance[row - 2][column - 2] + 1);
            }
        }
    }

    return distance[a.length][b.length];
}

//The letters of the short word, in order, somewhere in the long one: 'dta'
//in 'data'. Only from the first letter on, and only when the short word is
//at least half as long, or 'sae' would find 'storage'.
export function isSubsequence(short, long){
    if(!short || short[0] !== long[0] || short.length * 2 < long.length){
        return false;
    }

    let position = 0;

    for(const letter of short){
        position = long.indexOf(letter, position);
        if(position < 0){
            return false;
        }
        position++;
    }

    return true;
}

//How far off a typed word may be: not at all up to three letters, one up
//to six, two from seven on.
export function editsAllowed(word){
    return word.length <= 3 ? 0 : word.length <= 6 ? 1 : 2;
}

export function wordMatches(typed, word){
    if(word.startsWith(typed) || (typed.length >= 3 && word.includes(typed)) || isSubsequence(typed, word)){
        return true;
    }

    const allowed = editsAllowed(typed);

    if(!allowed){
        return false;
    }

    //The whole word a letter or two off, 'estorage' for 'storage'. Or as much
    //of the word as was typed, from the same first letter, or 'mail' would
    //find 'daily' through 'dail'.
    return editDistance(typed, word) <= allowed ||
        (typed[0] === word[0] && (
            editDistance(typed, word.slice(0, typed.length)) <= allowed ||
            editDistance(typed, word.slice(0, typed.length + 1)) <= allowed
        ));
}

//Whether every word typed matches a word of the texts, or the texts run
//together, for 'datastorage' typed as one.
export function matchesQuery(query, texts){
    const typedWords = wordsOf(query);

    if(!typedWords.length){
        return true;
    }

    const words = [].concat(...(texts || []).map(wordsOf));
    const joined = words.join('');

    return typedWords.every(typed =>
        words.some(word => wordMatches(typed, word)) || (typed.length >= 4 && joined.includes(typed))
    );
}
