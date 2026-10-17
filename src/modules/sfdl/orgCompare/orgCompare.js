import { retrieveFiles } from 'sfdl/metadataApi';
import { retrieveRequestFor } from 'sfdl/metadataCatalog';
import { splitMetadataFiles } from 'sfdl/metadataFiles';
import { retrieveCustomSettingFiles } from 'sfdl/customSettings';

export const DIFFERENT = 'different';
export const LEFT_ONLY = 'left';
export const RIGHT_ONLY = 'right';
export const IDENTICAL = 'identical';

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

export function countByStatus(entries){
    const counts = { all: entries.length, [DIFFERENT]: 0, [LEFT_ONLY]: 0, [RIGHT_ONLY]: 0, [IDENTICAL]: 0 };
    entries.forEach(entry => { counts[entry.status]++; });
    return counts;
}

//What one org holds of one type, kept for the session: going back to a type
//already compared, or comparing it against a third org, retrieves nothing.
const orgFiles = new Map();

function cacheKey(sessionInformation, type, apiVersion, includeManaged){
    return [sessionInformation.instanceUrl, type.key, apiVersion, includeManaged ? 'managed' : 'unmanaged'].join('|');
}

async function retrieveTypeFiles(sessionInformation, type, apiVersion, { includeManaged, onStatus }){
    if(type.engine === 'customSettings'){
        return { files: await retrieveCustomSettingFiles(sessionInformation, apiVersion, { includeManaged, onStatus }), problems: [] };
    }

    onStatus('Listing the components');

    const request = await retrieveRequestFor(type, sessionInformation, apiVersion, { includeManaged });

    if(!request.length){
        return { files: new Map(), problems: [] };
    }

    const { files, messages } = await retrieveFiles(sessionInformation, apiVersion, request, { onStatus });

    return {
        files: splitMetadataFiles(files),
        problems: messages.map(message => message.problem).filter(problem => problem)
    };
}

//{ files, problems } of one org for one type. problems are the components
//the org could not hand back, the rest of the files are still compared.
export function retrieveOrgFiles(sessionInformation, type, apiVersion, options = {}){
    const { includeManaged = false, refresh = false, onStatus = () => {} } = options;
    const key = cacheKey(sessionInformation, type, apiVersion, includeManaged);

    if(refresh){
        orgFiles.delete(key);
    }

    if(!orgFiles.has(key)){
        orgFiles.set(key, retrieveTypeFiles(sessionInformation, type, apiVersion, { includeManaged, onStatus }).catch(error => {
            orgFiles.delete(key);
            throw error;
        }));
    } else {
        onStatus('Already retrieved');
    }

    return orgFiles.get(key);
}
