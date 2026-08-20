import { manipulationDetailLogs } from 'sfdl/logDetailsManipulation';

const option = (name, checked = true) => ({ label: name, name, checked });

describe('manipulationDetailLogs', () => {
    it('returns an empty string when there are no log details', () => {
        expect(
            manipulationDetailLogs(undefined, [option('removeFlowNoise')])
        ).toBe('');
        expect(manipulationDetailLogs('', [option('removeFlowNoise')])).toBe(
            ''
        );
        expect(manipulationDetailLogs(null, undefined)).toBe('');
    });

    it('returns the log untouched when no manipulation options are provided', () => {
        const logDetails = 'line one\nline two';

        expect(manipulationDetailLogs(logDetails, undefined)).toBe(logDetails);
        expect(manipulationDetailLogs(logDetails, [])).toBe(logDetails);
    });

    it('returns the log untouched when every manipulation option is unchecked', () => {
        const logDetails = 'HEAP_ALLOCATE|something\nUSER_DEBUG|hello';

        const result = manipulationDetailLogs(logDetails, [
            option('removeHeapAllocateAndStatementExecute', false),
            option('removeFlowNoise', false)
        ]);

        expect(result).toBe(logDetails);
    });

    it('removes HEAP_ALLOCATE and STATEMENT_EXECUTE lines', () => {
        const logDetails = [
            '10:00:00.1 (1)|HEAP_ALLOCATE|[12]|Bytes:3',
            '10:00:00.2 (2)|USER_DEBUG|[5]|DEBUG|keep me',
            '10:00:00.3 (3)|STATEMENT_EXECUTE|[7]'
        ].join('\n');

        const result = manipulationDetailLogs(logDetails, [
            option('removeHeapAllocateAndStatementExecute')
        ]);

        expect(result).toBe('10:00:00.2 (2)|USER_DEBUG|[5]|DEBUG|keep me');
    });

    it('removes the flow noise lines', () => {
        const logDetails = [
            'FLOW_CREATE_INTERVIEW_BEGIN|x',
            'FLOW_CREATE_INTERVIEW_END|x',
            'FLOW_START_INTERVIEW_LIMIT_USAGE|x',
            'FLOW_ELEMENT_LIMIT_USAGE|x',
            'FLOW_INTERVIEW_FINISHED|x',
            'FLOW_INTERVIEW_FINISHED_LIMIT_USAGE|x',
            'USER_DEBUG|[1]|DEBUG|survivor'
        ].join('\n');

        const result = manipulationDetailLogs(logDetails, [
            option('removeFlowNoise')
        ]);

        expect(result).toBe('USER_DEBUG|[1]|DEBUG|survivor');
    });

    it('removes the SOQL_EXECUTE lines when extractSoqlLine is selected', () => {
        const logDetails = [
            '|SOQL_EXECUTE_BEGIN|[10]|Aggregations:0|SELECT Id FROM Account',
            '|USER_DEBUG|[11]|DEBUG|not a soql line'
        ].join('\n');

        const result = manipulationDetailLogs(logDetails, [
            option('extractSoqlLine')
        ]);

        expect(result).toBe(
            '|SOQL_EXECUTE_BEGIN|[10]|Aggregations:0|SELECT Id FROM Account'
        );
    });

    it('indents the log following the entry/exit hierarchy', () => {
        const logDetails = [
            '|CODE_UNIT_STARTED|[EXTERNAL]|MyTrigger',
            '|METHOD_ENTRY|[1]|MyClass.doWork()',
            '|USER_DEBUG|[2]|DEBUG|inside',
            '|METHOD_EXIT|[1]|MyClass.doWork()',
            '|CODE_UNIT_FINISHED|MyTrigger'
        ].join('\n');

        const result = manipulationDetailLogs(logDetails, [
            option('methodEntryExitCodeUnitStartedFinished2Hierarchy')
        ]).split('\n');

        expect(result[0]).toBe('|CODE_UNIT_STARTED|[EXTERNAL]|MyTrigger');
        expect(result[1]).toBe('\t|METHOD_ENTRY|[1]|MyClass.doWork()');
        expect(result[2]).toBe('\t\t|USER_DEBUG|[2]|DEBUG|inside');
        expect(result[3]).toBe('\t|METHOD_EXIT|[1]|MyClass.doWork()');
        expect(result[4]).toBe('|CODE_UNIT_FINISHED|MyTrigger');
    });

    it('treats flow begin/end markers as part of the hierarchy', () => {
        const logDetails = [
            '|FLOW_START_INTERVIEW_BEGIN|MyFlow',
            '|FLOW_ELEMENT_BEGIN|Decision',
            '|FLOW_ELEMENT_END|Decision',
            '|FLOW_START_INTERVIEW_END|MyFlow'
        ].join('\n');

        const result = manipulationDetailLogs(logDetails, [
            option('methodEntryExitCodeUnitStartedFinished2Hierarchy')
        ]).split('\n');

        expect(result[0]).toBe('|FLOW_START_INTERVIEW_BEGIN|MyFlow');
        expect(result[1]).toBe('\t|FLOW_ELEMENT_BEGIN|Decision');
        expect(result[2]).toBe('\t|FLOW_ELEMENT_END|Decision');
        expect(result[3]).toBe('|FLOW_START_INTERVIEW_END|MyFlow');
    });

    it('chains every checked manipulation option', () => {
        const logDetails = [
            '|CODE_UNIT_STARTED|[EXTERNAL]|MyTrigger',
            '|HEAP_ALLOCATE|[12]|Bytes:3',
            '|FLOW_ELEMENT_LIMIT_USAGE|noise',
            '|USER_DEBUG|[2]|DEBUG|inside',
            '|CODE_UNIT_FINISHED|MyTrigger'
        ].join('\n');

        const result = manipulationDetailLogs(logDetails, [
            option('methodEntryExitCodeUnitStartedFinished2Hierarchy'),
            option('removeHeapAllocateAndStatementExecute'),
            option('removeFlowNoise')
        ]).split('\n');

        expect(result).toEqual([
            '|CODE_UNIT_STARTED|[EXTERNAL]|MyTrigger',
            '\t|USER_DEBUG|[2]|DEBUG|inside',
            '|CODE_UNIT_FINISHED|MyTrigger'
        ]);
    });
});
