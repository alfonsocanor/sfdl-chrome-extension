const fileLinesAnalyseFunctions = {
    removeHeapAllocateAndStatementExecute(line){
        return line && (line.includes('HEAP_ALLOCATE') || line.includes('STATEMENT_EXECUTE')); 
    },

    removeFlowNoise(line){
        return line && (line.includes('FLOW_CREATE_INTERVIEW_BEGIN') 
            || line.includes('FLOW_CREATE_INTERVIEW_END')
            || line.includes('FLOW_START_INTERVIEW_LIMIT_USAGE')
            || line.includes('FLOW_ELEMENT_LIMIT_USAGE')
            || line.includes('FLOW_INTERVIEW_FINISHED')
            || line.includes('FLOW_INTERVIEW_FINISHED_LIMIT_USAGE')); 
    },

    extractSoqlLine(line){
        return line && !line.includes('SOQL_EXECUTE');
    },

    isMethodEntryLine(line){
        return line && (line.includes('|METHOD_ENTRY|') 
            || line.includes('|SYSTEM_METHOD_ENTRY|') 
            || line.includes('|CONSTRUCTOR_ENTRY|')
            || line.includes('|FLOW_START_INTERVIEW_BEGIN|')
            || line.includes('|FLOW_ELEMENT_BEGIN|'));
    },

    isMethodEntryExit(line){
        return line && (line.includes('|METHOD_EXIT|') 
            || line.includes('|SYSTEM_METHOD_EXIT|') 
            || line.includes('|CONSTRUCTOR_EXIT|')
            || line.includes('|FLOW_START_INTERVIEW_END|')
            || line.includes('|FLOW_ELEMENT_END|'));
    },

    isCodeUnitStarted(line){
        return line && line.includes('|CODE_UNIT_STARTED|');
    },

    isCodeUnitFinished(line){
        return line && line.includes('|CODE_UNIT_FINISHED|');
    }
}

const invokeLinesFormatting = {
    methodEntryExitCodeUnitStartedFinished2Hierarchy(fileLinesArray){
        let tabs2Add = 0;
        return fileLinesArray.map(line => {
            if(fileLinesAnalyseFunctions.isMethodEntryLine(line) || fileLinesAnalyseFunctions.isCodeUnitStarted(line)){
                tabs2Add++;
                return tabs2Add2Line(tabs2Add - 1) + line;
            }
            if(fileLinesAnalyseFunctions.isMethodEntryExit(line) || fileLinesAnalyseFunctions.isCodeUnitFinished(line)){
                if(tabs2Add  === 0){
                    return tabs2Add;
                }
                tabs2Add--;
            }
            return tabs2Add2Line(tabs2Add) + line;
        })
    },

    defaultFormatting(fileLinesArray, function2Execute){
        return fileLinesArray.filter(
            line => !fileLinesAnalyseFunctions[function2Execute](line)
        );
    }
}

function tabs2Add2Line(numberOfTabs){
    let tab = '\t';
    return tab.repeat(numberOfTabs);
}

function invokeFilterFormatFunctions(logDetailsArrayOfLines, function2Execute){
    return invokeLinesFormatting[function2Execute] ? invokeLinesFormatting[function2Execute](logDetailsArrayOfLines) : invokeLinesFormatting.defaultFormatting(logDetailsArrayOfLines, function2Execute);
}

export function manipulationDetailLogs(logDetails, manipulationOptions){
    if(!logDetails){
        return '';
    }

    let logDetailsArrayOfLines = logDetails.split('\n');
    let logDetailsFormatted;
    let manipulationOptionsChecked = manipulationOptions?.reduce((itContainsCheckedOptions, value) => {
        return value.checked || itContainsCheckedOptions;
    }, false);

    if(manipulationOptions && manipulationOptionsChecked){
        manipulationOptions.forEach((option) => {
            if(option.checked){
                logDetailsFormatted = invokeFilterFormatFunctions(logDetailsFormatted ? logDetailsFormatted : logDetailsArrayOfLines, option.name);
                logDetailsFormatted.join('\n');
            }
        })
    }
    
    return logDetailsFormatted ? logDetailsFormatted.join('\n') : logDetails;
}

//Two runs of the same transaction never share a timestamp, a record id or a
//heap address, so compared as they are every line of one log differs from the
//other. Each option rewrites the part of the line that can only ever differ.
const LOG_LINE_TIMESTAMP = /^(\t*)\d{1,2}:\d{2}:\d{2}\.\d+ \(\d+\)\|/gm;
//15 or 18 characters, the sixth one reserved and always 0, and at least one
//letter so a long number is not taken for an id. The key prefix is kept, it
//tells which object the record belongs to.
const SALESFORCE_ID = /(?<![a-zA-Z0-9])(?=[0-9]*[a-zA-Z])([a-zA-Z0-9]{3})[a-zA-Z0-9]{2}0[a-zA-Z0-9]{9}(?:[a-zA-Z0-9]{3})?(?![a-zA-Z0-9])/g;
const HEAP_ADDRESS = /\b0x[0-9a-f]+\b/gi;
const CODE_LINE_NUMBER = /\|\[\d+\]\|/g;

const compareNormalizations = {
    ignoreTimestamps(logDetails){
        return logDetails.replace(LOG_LINE_TIMESTAMP, '$1');
    },

    ignoreIdsAndAddresses(logDetails){
        return logDetails
            .replace(SALESFORCE_ID, '$1<id>')
            .replace(HEAP_ADDRESS, '0x<address>');
    },

    ignoreLineNumbers(logDetails){
        return logDetails.replace(CODE_LINE_NUMBER, '|[n]|');
    }
}

export function compareOptions(){
    return [
        { label: 'Ignore timestamps', name: 'ignoreTimestamps', checked: true },
        { label: 'Ignore record Ids and heap addresses', name: 'ignoreIdsAndAddresses', checked: true },
        { label: 'Ignore code line numbers', name: 'ignoreLineNumbers', checked: false }
    ];
}

export function normalizeLogForCompare(logDetails, options){
    if(!logDetails){
        return '';
    }

    return (options || []).reduce((normalizedLog, option) => {
        const normalization = compareNormalizations[option.name];
        return option.checked && normalization ? normalization(normalizedLog) : normalizedLog;
    }, logDetails);
}
