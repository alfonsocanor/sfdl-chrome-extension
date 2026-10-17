import { retrieveFiles } from 'sfdl/metadataApi';
import { listMetadataComponents } from 'sfdl/metadataCatalog';
import { splitMetadataFiles } from 'sfdl/metadataFiles';
import { listCustomSettings, readCustomSettingFile } from 'sfdl/customSettings';
import { mapWithConcurrency } from 'sfdl/salesforceConnection';

export const DIFFERENT = 'different';
export const LEFT_ONLY = 'left';
export const RIGHT_ONLY = 'right';
export const IDENTICAL = 'identical';
//A component both orgs list but neither handed any file of.
export const UNAVAILABLE = 'unavailable';
//What a component both orgs list is until it is compared, and while it is.
export const NOT_COMPARED = 'notCompared';
export const COMPARING = 'comparing';

const BATCH_SIZE = 100;
const CUSTOM_SETTINGS_IN_FLIGHT = 5;
//Folders whose components are folders of their own: an object split into its
//fields, a workflow into its rules, a bundle into its files.
const COMPONENT_FOLDERS = ['objects', 'workflows', 'lwc', 'aura'];

//An org that saved a file with windows line endings holds the same file as
//one that did not, and the diff would show no difference either.
function normalizeFile(file){
    return file.isBinary ? file : { ...file, content: file.content.replace(/\r\n/g, '\n') };
}

function statusOf(left, right){
    if(!right){
        return LEFT_ONLY;
    }

    if(!left){
        return RIGHT_ONLY;
    }

    return left.isBinary === right.isBinary && left.content === right.content ? IDENTICAL : DIFFERENT;
}

//Every path of either side with its status and the file of each side, by path.
export function compareFileSets(leftFiles, rightFiles){
    const paths = [...new Set([...leftFiles.keys(), ...rightFiles.keys()])].sort((a, b) => a.localeCompare(b));

    return paths.map(path => {
        const left = leftFiles.has(path) ? normalizeFile(leftFiles.get(path)) : undefined;
        const right = rightFiles.has(path) ? normalizeFile(rightFiles.get(path)) : undefined;

        return { path, status: statusOf(left, right), left, right };
    });
}

//The names one org holds of one type, kept for the session.
const orgComponentLists = new Map();

function cacheKey(sessionInformation, type, apiVersion, includeManaged){
    return [sessionInformation.instanceUrl, type.key, apiVersion, includeManaged ? 'managed' : 'unmanaged'].join('|');
}

//[{ name, lastModifiedDate, lastModifiedByName }] of one org for one type: a
//single call, listMetadata or describeGlobal, and nothing retrieved, so a big
//org can be browsed before deciding what is worth comparing.
export function listOrgComponents(sessionInformation, type, apiVersion, options = {}){
    const { includeManaged = false, refresh = false } = options;
    const key = cacheKey(sessionInformation, type, apiVersion, includeManaged);

    if(refresh){
        orgComponentLists.delete(key);
    }

    if(!orgComponentLists.has(key)){
        const listing = type.engine === 'customSettings' ?
            listCustomSettings(sessionInformation, apiVersion, { includeManaged }) :
            listMetadataComponents(type, sessionInformation, apiVersion, { includeManaged });

        orgComponentLists.set(key, listing.catch(error => {
            orgComponentLists.delete(key);
            throw error;
        }));
    }

    return orgComponentLists.get(key);
}

//The name listMetadata gives the component a file belongs to:
//classes/Foo.cls-meta.xml and classes/Foo.cls are Foo,
//objects/Account/fields/Tier__c.field is Account, labels/Greeting.label is
//Greeting and customMetadata/Rule.Gold.md is Rule.Gold.
export function componentOfPath(path){
    const segments = path.split('/');

    if(COMPONENT_FOLDERS.includes(segments[0]) && segments.length > 2){
        return segments[1];
    }

    const fileName = segments[segments.length - 1].replace(/-meta\.xml$/, '');
    const extensionIndex = fileName.lastIndexOf('.');

    return extensionIndex > 0 ? fileName.slice(0, extensionIndex) : fileName;
}

function chunk(items, size){
    const chunks = [];
    for(let index = 0; index < items.length; index += size){
        chunks.push(items.slice(index, index + size));
    }
    return chunks;
}

//The files of each component retrieved so far, per org, type and api version.
const componentFiles = new Map();

function componentKey(sessionInformation, type, apiVersion, name){
    return [sessionInformation.instanceUrl, type.key, apiVersion, name].join('|');
}

async function retrieveMetadataComponents(sessionInformation, type, apiVersion, names, onStatus){
    const batches = chunk(names, type.batchSize || BATCH_SIZE);
    const problems = [];

    for(let index = 0; index < batches.length; index++){
        const batch = batches[index];
        const prefix = batches.length > 1 ? 'Batch ' + (index + 1) + ' of ' + batches.length + ': ' : '';

        //One retrieve at a time, the org packages them one after the other anyway.
        // eslint-disable-next-line no-await-in-loop
        const { files, messages } = await retrieveFiles(sessionInformation, apiVersion,
            [{ name: type.metadataType, members: batch }],
            { onStatus: status => onStatus(prefix + status) });
        const filesByComponent = new Map(batch.map(name => [name, new Map()]));

        splitMetadataFiles(files).forEach((file, path) => {
            const name = componentOfPath(path);
            if(!filesByComponent.has(name)){
                filesByComponent.set(name, new Map());
            }
            filesByComponent.get(name).set(path, file);
        });

        filesByComponent.forEach((componentFileMap, name) => {
            componentFiles.set(componentKey(sessionInformation, type, apiVersion, name), componentFileMap);
        });

        problems.push(...messages.map(message => message.problem).filter(problem => problem));
    }

    return problems;
}

async function retrieveCustomSettings(sessionInformation, type, apiVersion, names, onStatus){
    let read = 0;

    await mapWithConcurrency(names, CUSTOM_SETTINGS_IN_FLIGHT, async name => {
        const { path, file } = await readCustomSettingFile(sessionInformation, apiVersion, name);
        componentFiles.set(componentKey(sessionInformation, type, apiVersion, name), new Map([[path, file]]));
        read++;
        onStatus('Read ' + read + ' of ' + names.length + ' custom settings');
    });

    return [];
}

//Forgets every component of a type retrieved from an org, so the next
//comparison retrieves them again.
export function forgetComponents(sessionInformation, type, apiVersion){
    const prefix = componentKey(sessionInformation, type, apiVersion, '');

    [...componentFiles.keys()]
        .filter(key => key.startsWith(prefix))
        .forEach(key => componentFiles.delete(key));
}

//{ files, problems }: the files of each named component of one org, a Map of
//name to a Map of path to file. Only what was never retrieved, or everything
//on refresh, goes to the org, in batches of a few components per retrieve.
export async function retrieveComponentFiles(sessionInformation, type, apiVersion, names, options = {}){
    const { refresh = false, onStatus = () => {} } = options;
    const missingNames = names.filter(name => refresh || !componentFiles.has(componentKey(sessionInformation, type, apiVersion, name)));
    let problems = [];

    if(missingNames.length){
        problems = type.engine === 'customSettings' ?
            await retrieveCustomSettings(sessionInformation, type, apiVersion, missingNames, onStatus) :
            await retrieveMetadataComponents(sessionInformation, type, apiVersion, missingNames, onStatus);
    } else {
        onStatus('Already retrieved');
    }

    return {
        files: new Map(names.map(name => [name, componentFiles.get(componentKey(sessionInformation, type, apiVersion, name)) || new Map()])),
        problems
    };
}

function componentStatus(presence, entries){
    if(presence !== 'both'){
        return presence === 'left' ? LEFT_ONLY : RIGHT_ONLY;
    }

    if(!entries.length){
        return UNAVAILABLE;
    }

    return entries.every(entry => entry.status === IDENTICAL) ? IDENTICAL : DIFFERENT;
}

//Compares the components given as [{ name, presence }], presence being both,
//left or right as the listings found them. Each org is only asked for the
//components it holds. Returns { components, left, right }: every component
//with its status and its files compared, and per org its problems or the
//error that stopped it, in which case the components are left out.
export async function compareComponents(leftSession, rightSession, type, apiVersion, components, options = {}){
    const { refresh = false, onStatus = () => {} } = options;
    const namesOf = side => components.filter(component => component.presence === 'both' || component.presence === side).map(component => component.name);
    const sides = { left: leftSession, right: rightSession };

    const [leftResult, rightResult] = await Promise.allSettled(['left', 'right'].map(side => {
        const names = namesOf(side);
        return names.length ?
            retrieveComponentFiles(sides[side], type, apiVersion, names, { refresh, onStatus: status => onStatus(side, status) }) :
            Promise.resolve({ files: new Map(), problems: [] });
    }));
    const outcome = result => (result.status === 'fulfilled' ? { problems: result.value.problems } : { error: result.reason.message });
    const compared = new Map();

    if(leftResult.status === 'fulfilled' && rightResult.status === 'fulfilled'){
        components.forEach(({ name, presence }) => {
            const entries = compareFileSets(
                leftResult.value.files.get(name) || new Map(),
                rightResult.value.files.get(name) || new Map()
            );
            compared.set(name, { status: componentStatus(presence, entries), entries });
        });
    }

    return { components: compared, left: outcome(leftResult), right: outcome(rightResult) };
}
