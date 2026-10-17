import { splitMetadataFiles } from 'sfdl/metadataFiles';

const ACCOUNT_OBJECT = `<?xml version="1.0" encoding="UTF-8"?>
<CustomObject xmlns="http://soap.sforce.com/2006/04/metadata">
    <actionOverrides>
        <actionName>View</actionName>
        <type>Default</type>
    </actionOverrides>
    <fields>
        <fullName>Rating__c</fullName>
        <label>Rating</label>
        <type>Number</type>
    </fields>
    <fields>
        <fullName>Tier__c</fullName>
        <label>Tier</label>
    </fields>
    <sharingModel>ReadWrite</sharingModel>
    <validationRules>
        <fullName>Rating_Positive</fullName>
        <active>true</active>
        <errorConditionFormula>Rating__c &lt; 0</errorConditionFormula>
    </validationRules>
</CustomObject>
`;

const LABELS = `<?xml version="1.0" encoding="UTF-8"?>
<CustomLabels xmlns="http://soap.sforce.com/2006/04/metadata">
    <labels>
        <fullName>Greeting</fullName>
        <language>en_US</language>
        <value>Hello</value>
    </labels>
    <labels>
        <fullName>Farewell</fullName>
        <language>en_US</language>
        <value>Bye &amp; see you</value>
    </labels>
</CustomLabels>
`;

const textFile = (content) => ({ content, isBinary: false });

describe('splitMetadataFiles', () => {
    it('splits an object into its fields, its rules and what is left of it', () => {
        const files = splitMetadataFiles(
            new Map([['objects/Account.object', textFile(ACCOUNT_OBJECT)]])
        );

        expect([...files.keys()].sort()).toEqual([
            'objects/Account/Account.object',
            'objects/Account/fields/Rating__c.field',
            'objects/Account/fields/Tier__c.field',
            'objects/Account/validationRules/Rating_Positive.validationRule'
        ]);
    });

    it('writes each component as it reads in the object, without the namespace', () => {
        const files = splitMetadataFiles(
            new Map([['objects/Account.object', textFile(ACCOUNT_OBJECT)]])
        );

        expect(
            files.get('objects/Account/fields/Rating__c.field').content
        ).toBe(
            [
                '<fields>',
                '    <fullName>Rating__c</fullName>',
                '    <label>Rating</label>',
                '    <type>Number</type>',
                '</fields>',
                ''
            ].join('\n')
        );
        expect(
            files.get(
                'objects/Account/validationRules/Rating_Positive.validationRule'
            ).content
        ).toContain(
            '<errorConditionFormula>Rating__c &lt; 0</errorConditionFormula>'
        );
    });

    it('keeps the properties of the object itself in a file of their own', () => {
        const files = splitMetadataFiles(
            new Map([['objects/Account.object', textFile(ACCOUNT_OBJECT)]])
        );
        const parent = files.get('objects/Account/Account.object').content;

        expect(parent).toContain('<sharingModel>ReadWrite</sharingModel>');
        expect(parent).toContain('<actionName>View</actionName>');
        expect(parent).not.toContain('<fields>');
        expect(parent).not.toMatch(/\n\s*\n\s*\n/);
    });

    it('splits the labels into one file per label', () => {
        const files = splitMetadataFiles(
            new Map([['labels/CustomLabels.labels', textFile(LABELS)]])
        );

        expect([...files.keys()].sort()).toEqual([
            'labels/Farewell.label',
            'labels/Greeting.label'
        ]);
        expect(files.get('labels/Farewell.label').content).toContain(
            '<value>Bye &amp; see you</value>'
        );
    });

    it('splits a workflow into its rules and actions', () => {
        const workflow = `<?xml version="1.0" encoding="UTF-8"?>
<Workflow xmlns="http://soap.sforce.com/2006/04/metadata">
    <fieldUpdates>
        <fullName>Set_Tier</fullName>
        <field>Tier__c</field>
    </fieldUpdates>
    <rules>
        <fullName>Tier on create</fullName>
        <active>true</active>
    </rules>
</Workflow>
`;

        const files = splitMetadataFiles(
            new Map([['workflows/Account.workflow', textFile(workflow)]])
        );

        expect([...files.keys()].sort()).toEqual([
            'workflows/Account/fieldUpdates/Set_Tier.fieldUpdate',
            'workflows/Account/rules/Tier on create.rule'
        ]);
    });

    it('keeps the files it has nothing to split as they are', () => {
        const apexClass = textFile('public class Foo {}');
        const emptyObject = textFile(
            '<?xml version="1.0"?><CustomObject xmlns="http://soap.sforce.com/2006/04/metadata"><label>Thing</label></CustomObject>'
        );
        const brokenObject = textFile('<CustomObject><fields>');
        const binary = { content: 'iVBORw==', isBinary: true };

        const files = splitMetadataFiles(
            new Map([
                ['classes/Foo.cls', apexClass],
                ['objects/Thing__c.object', emptyObject],
                ['objects/Broken__c.object', brokenObject],
                ['staticresources/logo.resource', binary]
            ])
        );

        expect(files.get('classes/Foo.cls')).toBe(apexClass);
        expect(files.get('objects/Thing__c.object')).toBe(emptyObject);
        expect(files.get('objects/Broken__c.object')).toBe(brokenObject);
        expect(files.get('staticresources/logo.resource')).toBe(binary);
    });

    it('splits the same object the same way in two orgs', () => {
        const reordered = ACCOUNT_OBJECT.replace(
            '<sharingModel>ReadWrite</sharingModel>',
            '<sharingModel>Private</sharingModel>'
        );

        const left = splitMetadataFiles(
            new Map([['objects/Account.object', textFile(ACCOUNT_OBJECT)]])
        );
        const right = splitMetadataFiles(
            new Map([['objects/Account.object', textFile(reordered)]])
        );

        expect(right.get('objects/Account/fields/Rating__c.field')).toEqual(
            left.get('objects/Account/fields/Rating__c.field')
        );
        expect(right.get('objects/Account/Account.object')).not.toEqual(
            left.get('objects/Account/Account.object')
        );
    });
});
