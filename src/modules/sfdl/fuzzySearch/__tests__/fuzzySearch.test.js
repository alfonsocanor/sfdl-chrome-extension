import { wordsOf, editDistance, isSubsequence, editsAllowed, wordMatches, matchesQuery } from 'sfdl/fuzzySearch';

describe('fuzzySearch', () => {
    it('takes a text apart into lower case words, a camel cased name at its capitals', () => {
        expect(wordsOf('Data storage, MB')).toEqual(['data', 'storage', 'mb']);
        expect(wordsOf('DataStorageMB')).toEqual(['data', 'storage', 'mb']);
        expect(wordsOf('DailyApiRequests')).toEqual(['daily', 'api', 'requests']);
        expect(wordsOf('')).toEqual([]);
        expect(wordsOf(undefined)).toEqual([]);
    });

    it('counts the edits between two words, a swap of neighbours being one', () => {
        expect(editDistance('storage', 'storage')).toBe(0);
        expect(editDistance('strage', 'storage')).toBe(1);
        expect(editDistance('estorage', 'storage')).toBe(1);
        expect(editDistance('dta', 'data')).toBe(1);
        expect(editDistance('dat', 'dta')).toBe(1);
        expect(editDistance('', 'abc')).toBe(3);
    });

    it('finds the letters of a short word in order in a long one, from its first letter', () => {
        expect(isSubsequence('dta', 'data')).toBe(true);
        expect(isSubsequence('strg', 'storage')).toBe(true);
        expect(isSubsequence('sae', 'storage')).toBe(false);
        expect(isSubsequence('ata', 'data')).toBe(false);
        expect(isSubsequence('', 'data')).toBe(false);
    });

    it('allows more edits to a longer word', () => {
        expect(editsAllowed('dat')).toBe(0);
        expect(editsAllowed('data')).toBe(1);
        expect(editsAllowed('storage')).toBe(2);
    });

    it('matches a word by its start, its letters in order or a letter or two off', () => {
        expect(wordMatches('dat', 'data')).toBe(true);
        expect(wordMatches('dta', 'data')).toBe(true);
        expect(wordMatches('strage', 'storage')).toBe(true);
        expect(wordMatches('estorage', 'storage')).toBe(true);
        expect(wordMatches('stroage', 'storage')).toBe(true);
        expect(wordMatches('mail', 'emails')).toBe(true);
        expect(wordMatches('mail', 'daily')).toBe(false);
        expect(wordMatches('mial', 'mail')).toBe(true);
        expect(wordMatches('api', 'apex')).toBe(false);
        expect(wordMatches('xyz', 'storage')).toBe(false);
    });

    it('matchesQuery wants every word typed somewhere in the texts', () => {
        const texts = ['Data storage, MB', 'DataStorageMB', 'db'];

        expect(matchesQuery('data storage', texts)).toBe(true);
        expect(matchesQuery('dta strage', texts)).toBe(true);
        expect(matchesQuery('datastorage', texts)).toBe(true);
        expect(matchesQuery('db', texts)).toBe(true);
        expect(matchesQuery('storage file', texts)).toBe(false);
        expect(matchesQuery('', texts)).toBe(true);
        expect(matchesQuery('   ', texts)).toBe(true);
        expect(matchesQuery('data', [])).toBe(false);
    });
});
