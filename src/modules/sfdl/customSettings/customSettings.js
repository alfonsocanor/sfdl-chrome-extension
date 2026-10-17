import { describeGlobal, describeSObject, queryAll, mapWithConcurrency } from 'sfdl/salesforceConnection';

//Custom settings hold their values as records, data the Metadata API has none
//of, and the values are what tends to drift between orgs: an endpoint, a
//switch, a threshold. Each setting is written out as one document with its
//fields and every one of its values, in an order that does not depend on the
//org, so two orgs compare line by line.
const DESCRIBES_IN_FLIGHT = 5;
const ORGANIZATION_KEY_PREFIX = '00D';
const PROFILE_KEY_PREFIX = '00e';
const USER_KEY_PREFIX = '005';
const INDENT = '  ';

//ns__Setting__c carries the namespace of a managed package.
function isNamespaced(sObjectName){
    return (sObjectName.match(/__/g) || []).length > 1;
}

function fieldType(field){
    switch(field.type){
        case 'string':
            return 'Text(' + field.length + ')';
        case 'textarea':
            return 'Text Area(' + field.length + ')';
        case 'double':
        case 'int':
            return 'Number(' + field.precision + ', ' + field.scale + ')';
        case 'currency':
            return 'Currency(' + field.precision + ', ' + field.scale + ')';
        case 'percent':
            return 'Percent(' + field.precision + ', ' + field.scale + ')';
        case 'boolean':
            return 'Checkbox';
        case 'datetime':
            return 'Date/Time';
        default:
            return field.type.charAt(0).toUpperCase() + field.type.slice(1);
    }
}

function formatValue(value){
    if(value === null || value === undefined){
        return '';
    }

    //A value on several lines stays on one, quoted, so it cannot pass for the
    //next field.
    return typeof value === 'string' && value.includes('\n') ? JSON.stringify(value) : String(value);
}

//The owner of a hierarchy value by kind, the org default first, then the
//profiles and the users by name, since record ids differ from org to org.
function ownerOf(record){
    const ownerId = record.SetupOwnerId || '';
    const ownerName = record.SetupOwner ? record.SetupOwner.Name : ownerId;

    if(ownerId.startsWith(ORGANIZATION_KEY_PREFIX)){
        return { order: 0, label: 'Org Default' };
    }

    if(ownerId.startsWith(PROFILE_KEY_PREFIX)){
        return { order: 1, label: 'Profile: ' + ownerName };
    }

    if(ownerId.startsWith(USER_KEY_PREFIX)){
        return { order: 2, label: 'User: ' + ownerName };
    }

    return { order: 3, label: 'Owner: ' + ownerName };
}

function valueGroups(records, customFields, isHierarchy){
    return records
        .map(record => ({
            ...(isHierarchy ? ownerOf(record) : { order: 0, label: 'Record: ' + record.Name }),
            values: customFields.map(field => INDENT + INDENT + field.name + ': ' + formatValue(record[field.name]))
        }))
        .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
}

export function customSettingDocument(describe, records, valuesError){
    const customFields = describe.fields
        .filter(field => field.custom)
        .sort((a, b) => a.name.localeCompare(b.name));
    const isHierarchy = describe.fields.some(field => field.name === 'SetupOwnerId');
    const lines = [
        'Custom Setting: ' + describe.name,
        'Label: ' + describe.label,
        'Type: ' + (isHierarchy ? 'Hierarchy' : 'List'),
        '',
        'Fields:',
        ...customFields.map(field => INDENT + field.name + ': ' + fieldType(field)),
        '',
        'Values:'
    ];

    if(valuesError){
        lines.push(INDENT + 'The values could not be read: ' + valuesError);
    } else if(!records.length){
        lines.push(INDENT + 'None');
    } else {
        valueGroups(records, customFields, isHierarchy).forEach(group => {
            lines.push(INDENT + group.label + ':', ...group.values);
        });
    }

    return lines.join('\n') + '\n';
}

async function readCustomSetting(sessionInformation, apiVersion, sObjectName){
    const describe = await describeSObject(sessionInformation, sObjectName, apiVersion);
    const isHierarchy = describe.fields.some(field => field.name === 'SetupOwnerId');
    const fieldNames = [
        'Name',
        ...(isHierarchy ? ['SetupOwnerId', 'SetupOwner.Name'] : []),
        ...describe.fields.filter(field => field.custom).map(field => field.name)
    ];
    let records = [];
    let valuesError;

    //A setting the user cannot read still has its definition compared.
    try{
        records = await queryAll(sessionInformation, 'SELECT ' + fieldNames.join(', ') + ' FROM ' + sObjectName, { apiVersion });
    } catch(error){
        valuesError = error.message;
    }

    return customSettingDocument(describe, records, valuesError);
}

//The custom settings of the org as files, customSettings/Name__c.setting,
//the shape retrieveFiles hands the metadata back in.
export async function retrieveCustomSettingFiles(sessionInformation, apiVersion, options = {}){
    const { includeManaged = false, onStatus = () => {} } = options;

    onStatus('Listing the custom settings');

    const { sobjects } = await describeGlobal(sessionInformation, apiVersion);
    const settingNames = sobjects
        .filter(sObject => sObject.customSetting && (includeManaged || !isNamespaced(sObject.name)))
        .map(sObject => sObject.name)
        .sort();
    let settingsRead = 0;

    const documents = await mapWithConcurrency(settingNames, DESCRIBES_IN_FLIGHT, async settingName => {
        const document = await readCustomSetting(sessionInformation, apiVersion, settingName);
        settingsRead++;
        onStatus('Read ' + settingsRead + ' of ' + settingNames.length + ' custom settings');
        return document;
    });

    return new Map(settingNames.map((settingName, index) => [
        'customSettings/' + settingName + '.setting',
        { content: documents[index], isBinary: false }
    ]));
}
