//A retrieve hands back some metadata as one file holding many components:
//every field, rule and view of an object in its .object file, every label in
//CustomLabels.labels. Split the way the source format of sfdx splits them,
//each component is a file of its own, so a comparison can tell that one field
//changed instead of reporting the whole object as different.
const NAMESPACE_ATTRIBUTE = / xmlns="http:\/\/soap\.sforce\.com\/2006\/04\/metadata"/;
const XML_DECLARATION = '<?xml version="1.0" encoding="UTF-8"?>\n';
const TEXT_NODE = 3;

const OBJECT_CHILDREN = {
    fields: 'field',
    validationRules: 'validationRule',
    recordTypes: 'recordType',
    listViews: 'listView',
    webLinks: 'webLink',
    compactLayouts: 'compactLayout',
    fieldSets: 'fieldSet',
    businessProcesses: 'businessProcess',
    sharingReasons: 'sharingReason',
    indexes: 'index'
};

const WORKFLOW_CHILDREN = {
    alerts: 'alert',
    fieldUpdates: 'fieldUpdate',
    rules: 'rule',
    tasks: 'task',
    outboundMessages: 'outboundMessage',
    knowledgePublishes: 'knowledgePublish'
};

const SPLITS = [
    {
        pattern: /^objects\/([^/]+)\.object$/,
        children: OBJECT_CHILDREN,
        childPath: (name, childType, fullName) => 'objects/' + name + '/' + childType + '/' + fullName + '.' + OBJECT_CHILDREN[childType],
        parentPath: name => 'objects/' + name + '/' + name + '.object'
    },
    {
        pattern: /^workflows\/([^/]+)\.workflow$/,
        children: WORKFLOW_CHILDREN,
        childPath: (name, childType, fullName) => 'workflows/' + name + '/' + childType + '/' + fullName + '.' + WORKFLOW_CHILDREN[childType],
        parentPath: name => 'workflows/' + name + '/' + name + '.workflow'
    },
    {
        pattern: /^labels\/([^/]+)\.labels$/,
        children: { labels: 'label' },
        childPath: (name, childType, fullName) => 'labels/' + fullName + '.label',
        parentPath: name => 'labels/' + name + '.labels'
    }
];

function childText(element, localName){
    const child = [...element.children].find(candidate => candidate.localName === localName);
    return child ? child.textContent : undefined;
}

//The whitespace that indents an element, read from the text right before it.
function indentationOf(element){
    const previous = element.previousSibling;

    if(previous && previous.nodeType === TEXT_NODE){
        const text = previous.textContent;
        return text.slice(text.lastIndexOf('\n') + 1);
    }

    return '';
}

function serializeElement(element){
    const indentation = indentationOf(element);
    const xml = new XMLSerializer().serializeToString(element).replace(NAMESPACE_ATTRIBUTE, '');

    //The element comes out without the indentation of its first line, its
    //other lines are taken back by as much.
    return xml
        .split('\n')
        .map((line, index) => (index && indentation && line.startsWith(indentation) ? line.slice(indentation.length) : line))
        .join('\n') + '\n';
}

function removeElement(element){
    const previous = element.previousSibling;

    if(previous && previous.nodeType === TEXT_NODE && !previous.textContent.trim()){
        previous.remove();
    }

    element.remove();
}

function splitFile(path, content, split){
    const name = path.match(split.pattern)[1];
    const fileDocument = new DOMParser().parseFromString(content, 'text/xml');

    if(fileDocument.getElementsByTagName('parsererror').length){
        return null;
    }

    const root = fileDocument.documentElement;
    const parts = new Map();

    [...root.children].forEach(child => {
        const fullName = split.children[child.localName] && childText(child, 'fullName');

        if(fullName){
            parts.set(split.childPath(name, child.localName, fullName), serializeElement(child));
            removeElement(child);
        }
    });

    if(!parts.size){
        return null;
    }

    //What is left describes the parent itself: the label of an object, its
    //sharing model... Kept as a file of its own when there is any.
    if(root.children.length){
        parts.set(split.parentPath(name), XML_DECLARATION + new XMLSerializer().serializeToString(root) + '\n');
    }

    return parts;
}

//files maps each path to { content, isBinary }, the way retrieveFiles hands
//them back. A file that cannot be split, or holds nothing to split, is kept
//as it is.
export function splitMetadataFiles(files){
    const splitFiles = new Map();

    files.forEach((file, path) => {
        const split = !file.isBinary && SPLITS.find(candidate => candidate.pattern.test(path));
        const parts = split ? splitFile(path, file.content, split) : null;

        if(parts){
            parts.forEach((content, partPath) => splitFiles.set(partPath, { content, isBinary: false }));
        } else {
            splitFiles.set(path, file);
        }
    });

    return splitFiles;
}
