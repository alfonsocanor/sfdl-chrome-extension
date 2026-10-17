import {
    manipulationDetailLogs,
    compareOptions,
    normalizeLogForCompare
} from 'sfdl/logDetailsManipulation';

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

describe('normalizeLogForCompare', () => {
    const only = (name) =>
        compareOptions().map((compareOption) => ({
            ...compareOption,
            checked: compareOption.name === name
        }));

    it('returns an empty string when there are no log details', () => {
        expect(normalizeLogForCompare(undefined, compareOptions())).toBe('');
    });

    it('returns the log untouched without options', () => {
        expect(normalizeLogForCompare('10:00:00.1 (1)|USER_DEBUG', [])).toBe(
            '10:00:00.1 (1)|USER_DEBUG'
        );
    });

    it('ignores timestamps by default, ids and addresses too, but not line numbers', () => {
        expect(
            compareOptions().map(({ name, checked }) => [name, checked])
        ).toEqual([
            ['ignoreTimestamps', true],
            ['ignoreIdsAndAddresses', true],
            ['ignoreLineNumbers', false]
        ]);
    });

    it('drops the timestamp that opens each line and keeps the indentation', () => {
        const logDetails = [
            '60.0 APEX_CODE,FINEST;APEX_PROFILING,INFO',
            '14:30:01.123 (123456789)|CODE_UNIT_STARTED|[EXTERNAL]|execute_anonymous_apex',
            '\t14:30:01.125 (125000000)|USER_DEBUG|[2]|DEBUG|hello',
            'a second line of the same debug message'
        ].join('\n');

        expect(
            normalizeLogForCompare(logDetails, only('ignoreTimestamps'))
        ).toBe(
            [
                '60.0 APEX_CODE,FINEST;APEX_PROFILING,INFO',
                'CODE_UNIT_STARTED|[EXTERNAL]|execute_anonymous_apex',
                '\tUSER_DEBUG|[2]|DEBUG|hello',
                'a second line of the same debug message'
            ].join('\n')
        );
    });

    it('replaces record ids but keeps their key prefix', () => {
        const logDetails =
            'SOQL_EXECUTE_END|[4]|Rows:1 001xx000003DGbYAAW 0035g00000AbCdE';

        expect(
            normalizeLogForCompare(logDetails, only('ignoreIdsAndAddresses'))
        ).toBe('SOQL_EXECUTE_END|[4]|Rows:1 001<id> 003<id>');
    });

    it('leaves words and long numbers that only look like ids alone', () => {
        const logDetails =
            'METHOD_ENTRY|[1]|01p5g00000AbCdE|AccountService.recalculate 123450123456789 ABCDE0FGHIJKLMNOPQRSTUV';

        expect(
            normalizeLogForCompare(logDetails, only('ignoreIdsAndAddresses'))
        ).toBe(
            'METHOD_ENTRY|[1]|01p<id>|AccountService.recalculate 123450123456789 ABCDE0FGHIJKLMNOPQRSTUV'
        );
    });

    it('replaces heap addresses', () => {
        expect(
            normalizeLogForCompare(
                'VARIABLE_ASSIGNMENT|[7]|this|{}|0x7d7d4e32',
                only('ignoreIdsAndAddresses')
            )
        ).toBe('VARIABLE_ASSIGNMENT|[7]|this|{}|0x<address>');
    });

    it('replaces the code line numbers when asked to', () => {
        expect(
            normalizeLogForCompare(
                'USER_DEBUG|[12]|DEBUG|value [3]',
                only('ignoreLineNumbers')
            )
        ).toBe('USER_DEBUG|[n]|DEBUG|value [3]');
    });

    it('makes two runs of the same transaction identical', () => {
        const run = (time, nanos, recordId, address) =>
            [
                time +
                    ' (' +
                    nanos +
                    ')|DML_BEGIN|[8]|Op:Insert|Type:Account|Rows:1',
                time +
                    ' (' +
                    nanos +
                    ')|VARIABLE_ASSIGNMENT|[9]|a|' +
                    recordId +
                    '|' +
                    address
            ].join('\n');

        expect(
            normalizeLogForCompare(
                run('09:00:00.100', '1000', '001xx000003DGbYAAW', '0x1a2b'),
                compareOptions()
            )
        ).toBe(
            normalizeLogForCompare(
                run('17:45:12.987', '98765', '001xx000004XyZaAAW', '0x9f9f'),
                compareOptions()
            )
        );
    });
});
