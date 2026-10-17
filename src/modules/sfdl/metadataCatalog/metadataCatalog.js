import { listMetadata } from 'sfdl/metadataApi';

const CODE = 'Code';
const USER_INTERFACE = 'User interface';
const DATA_MODEL = 'Data model';
const AUTOMATION = 'Automation';
const CONFIGURATION = 'Configuration';

//How the files of each type come out of an org:
//- metadata retrieves the type through the Metadata API, every component
//  through the * wildcard, or the standard objects that listMetadata names
//  since the wildcard of CustomObject only covers custom ones.
//- customSettings reads the settings and their values through REST, values
//  are data and the Metadata API has none of them.
//
//Profiles and permission sets are left out on purpose: retrieved on their own
//they only carry the permissions of the other components of the same
//retrieve, so comparing them alone would report differences that are not
//there.
export const METADATA_TYPES = [
    { key: 'ApexClass', label: 'Apex Classes', group: CODE, engine: 'metadata', metadataType: 'ApexClass' },
    { key: 'ApexTrigger', label: 'Apex Triggers', group: CODE, engine: 'metadata', metadataType: 'ApexTrigger' },
    { key: 'ApexPage', label: 'Visualforce Pages', group: CODE, engine: 'metadata', metadataType: 'ApexPage' },
    { key: 'ApexComponent', label: 'Visualforce Components', group: CODE, engine: 'metadata', metadataType: 'ApexComponent' },
    { key: 'LightningComponentBundle', label: 'Lightning Web Components', group: USER_INTERFACE, engine: 'metadata', metadataType: 'LightningComponentBundle' },
    { key: 'AuraDefinitionBundle', label: 'Aura Components', group: USER_INTERFACE, engine: 'metadata', metadataType: 'AuraDefinitionBundle' },
    { key: 'FlexiPage', label: 'Lightning Pages', group: USER_INTERFACE, engine: 'metadata', metadataType: 'FlexiPage' },
    { key: 'Layout', label: 'Page Layouts', group: USER_INTERFACE, engine: 'metadata', metadataType: 'Layout' },
    { key: 'StaticResource', label: 'Static Resources', group: USER_INTERFACE, engine: 'metadata', metadataType: 'StaticResource' },
    { key: 'CustomObjects', label: 'Custom Objects', group: DATA_MODEL, engine: 'metadata', metadataType: 'CustomObject' },
    { key: 'StandardObjects', label: 'Standard Objects', group: DATA_MODEL, engine: 'metadata', metadataType: 'CustomObject', members: 'standardObjects' },
    { key: 'CustomSettings', label: 'Custom Settings', group: DATA_MODEL, engine: 'customSettings' },
    { key: 'CustomMetadata', label: 'Custom Metadata Records', group: DATA_MODEL, engine: 'metadata', metadataType: 'CustomMetadata' },
    { key: 'GlobalValueSet', label: 'Global Value Sets', group: DATA_MODEL, engine: 'metadata', metadataType: 'GlobalValueSet' },
    { key: 'Flow', label: 'Flows', group: AUTOMATION, engine: 'metadata', metadataType: 'Flow' },
    { key: 'Workflow', label: 'Workflow Rules', group: AUTOMATION, engine: 'metadata', metadataType: 'Workflow' },
    { key: 'CustomLabel', label: 'Custom Labels', group: CONFIGURATION, engine: 'metadata', metadataType: 'CustomLabel' },
    { key: 'CustomPermission', label: 'Custom Permissions', group: CONFIGURATION, engine: 'metadata', metadataType: 'CustomPermission' },
    { key: 'RemoteSiteSetting', label: 'Remote Site Settings', group: CONFIGURATION, engine: 'metadata', metadataType: 'RemoteSiteSetting' },
    { key: 'NamedCredential', label: 'Named Credentials', group: CONFIGURATION, engine: 'metadata', metadataType: 'NamedCredential' }
];

export function getMetadataType(key){
    return METADATA_TYPES.find(type => type.key === key);
}

export function metadataTypeOptions(){
    return METADATA_TYPES.map(({ key, label, group }) => ({ label, value: key, group }));
}

function isStandardObject(fullName){
    return !fullName.includes('__');
}

//The members to retrieve for a type. The * wildcard leaves the components of
//managed packages out, so including them means naming every component the
//org lists.
export async function retrieveRequestFor(type, sessionInformation, apiVersion, { includeManaged = false } = {}){
    if(type.members === 'standardObjects'){
        const objects = await listMetadata(sessionInformation, apiVersion, [{ type: type.metadataType }]);
        const members = objects.map(({ fullName }) => fullName).filter(isStandardObject).sort();
        return members.length ? [{ name: type.metadataType, members }] : [];
    }

    if(includeManaged){
        const components = await listMetadata(sessionInformation, apiVersion, [{ type: type.metadataType }]);
        const members = components.map(({ fullName }) => fullName).sort();
        return members.length ? [{ name: type.metadataType, members }] : [];
    }

    return [{ name: type.metadataType, members: ['*'] }];
}

const LANGUAGE_BY_EXTENSION = {
    cls: 'apex',
    trigger: 'apex',
    page: 'html',
    component: 'html',
    html: 'html',
    cmp: 'html',
    app: 'html',
    evt: 'html',
    intf: 'html',
    design: 'html',
    tokens: 'html',
    auradoc: 'html',
    js: 'javascript',
    css: 'css',
    json: 'json',
    svg: 'xml',
    xml: 'xml',
    //The documents the custom settings are written out as read like yaml.
    setting: 'yaml'
};

//The editor language of a file, by its extension, and xml for the many
//metadata files whose extension only names their type.
export function languageForFile(path, content = ''){
    const extension = (path.split('/').pop().split('.').pop() || '').toLowerCase();

    if(LANGUAGE_BY_EXTENSION[extension]){
        return LANGUAGE_BY_EXTENSION[extension];
    }

    return content.trimStart().startsWith('<') ? 'xml' : 'plaintext';
}
