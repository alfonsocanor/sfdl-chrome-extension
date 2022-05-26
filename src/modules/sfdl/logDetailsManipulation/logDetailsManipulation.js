const fileLinesAnalyseFunctions = {
    removeHeapAllocateAndStatementExecute(line){
        return line.includes('HEAP_ALLOCATE') || line.includes('STATEMENT_EXECUTE'); 
    },

    extractSoqlLine(line){
        return !line.includes('SOQL_EXECUTE');
    },

    isMethodEntryLine(line){
        return line.includes('|METHOD_ENTRY|') || line.includes('|SYSTEM_METHOD_ENTRY|') || line.includes('|CONSTRUCTOR_ENTRY|');
    },

    isMethodEntryExit(line){
        return line.includes('|METHOD_EXIT|') || line.includes('|SYSTEM_METHOD_EXIT|') || line.includes('|CONSTRUCTOR_EXIT|');
    },
    isCodeUnitStarted(line){
        return line.includes('|CODE_UNIT_STARTED|');
    },
    isCodeUnitFinished(line){
        return line.includes('|CODE_UNIT_FINISHED|');
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
    let tabs2Return = numberOfTabs === 0 ? '' : '\t';
    for(let counter = 1; counter < numberOfTabs; counter++){
        tabs2Return = tabs2Return + '\t';
    }
    return tabs2Return;
}

function invokeFilterFormatFunctions(logDetailsArrayOfLines, function2Execute){
    return invokeLinesFormatting[function2Execute] ? invokeLinesFormatting[function2Execute](logDetailsArrayOfLines) : invokeLinesFormatting.defaultFormatting(logDetailsArrayOfLines, function2Execute);
}

export function manipulationDetailLogs(logDetails, manipulationOptions){
    let logDetailsArrayOfLines = logDetails.split('\n');
    let logDetailsFormatted; 
    if(manipulationOptions){
        manipulationOptions.forEach((option) => {
            if(option.checked){
                logDetailsFormatted = invokeFilterFormatFunctions(logDetailsFormatted ? logDetailsFormatted : logDetailsArrayOfLines, option.name);
                logDetailsFormatted.join('\n');
            }
        })
    }
    
    return logDetailsFormatted ? logDetailsFormatted.join('\n') : logDetails;
}