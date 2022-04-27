import { LightningElement } from 'lwc';

export default class Console extends LightningElement {
    logFile;
    richtext;
    logDetail;
    connectedCallback(){
        this.richtext = '54.0 APEX_CODE,FINEST;APEX_PROFILING,INFO;CALLOUT,INFO;DB,INFO;NBA,INFO;SYSTEM,DEBUG;VALIDATION,INFO;VISUALFORCE,INFO;WAVE,INFO;WORKFLOW,INFO\n' + 
        '10:25:11.0 (245664)|USER_INFO|[EXTERNAL]|0052v00000fQDGY|api@naturalchemist.com.au.sand1|(GMT+10:00) Australian Eastern Standard Time (Australia/Sydney)|GMT+10:00\n' +
        '10:25:11.0 (309214)|EXECUTION_STARTED\n' + 
        '10:25:11.0 (314547)|CODE_UNIT_STARTED|[EXTERNAL]|DuplicateDetector\n' + 
        '10:25:11.0 (327814)|DUPLICATE_DETECTION_BEGIN\n' + 
        '10:25:11.0 (467938)|DUPLICATE_DETECTION_RULE_INVOCATION|DuplicateRuleId:0Bm2v00000FkLQl|DuplicateRuleName:match contact by email|DmlType:\n' + 
        '10:25:11.0 (50821724)|DUPLICATE_DETECTION_MATCH_INVOCATION_DETAILS|EntityId:0031y00000DlT0T|ActionTaken:|DuplicateRecordIds:\n' + 
        '10:25:11.0 (50865020)|DUPLICATE_DETECTION_MATCH_INVOCATION_SUMMARY|EntityType:Contact|NumRecordsToBeSaved:1|NumRecordsToBeSavedWithDuplicates:0|NumDuplicateRecordsFound:0\n' + 
        '10:25:11.0 (51944724)|DUPLICATE_DETECTION_END\n' + 
        '10:25:11.0 (51961169)|CODE_UNIT_FINISHED|DuplicateDetector\n' + 
        '10:25:11.0 (51972648)|EXECUTION_FINISHED\n';
        console.log('connectedCallback launchpad');
    }

    async handleLogDetail(event){
        let sfdlLogDetailsComponent = this.template.querySelector('sfdl-log-details');
        sfdlLogDetailsComponent.displayLogsDetailsFromLogList(event.detail.logDetail, event.detail.logName);
    }
}