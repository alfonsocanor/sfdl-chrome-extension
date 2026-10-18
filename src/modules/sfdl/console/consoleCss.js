export const css = `
    /* The tabs sit on a light grey strip. The open one is white and joins
       what it shows below, a thin light blue line on top. */
    .sfdl-console-tabs > .slds-tabs_scoped__nav {
        background: #f3f3f3;
        border: 0;
        border-bottom: 1px solid #dddbda;
        border-radius: 0;
    }

    .sfdl-console-tabs .slds-tabs_scoped__link {
        padding: 0 1rem;
        color: #5c5c5c;
    }

    .sfdl-console-tabs .slds-tabs_scoped__link:hover {
        background: #fafaf9;
        border-color: transparent;
        color: #181818;
    }

    .sfdl-console-tabs .slds-is-active .slds-tabs_scoped__link,
    .sfdl-console-tabs .slds-is-active .slds-tabs_scoped__link:hover {
        background: #ffffff;
        border-left-color: #dddbda;
        border-right-color: #dddbda;
        box-shadow: inset 0 2px 0 #78b0fd;
        color: #181818;
    }

    .sfdl-console-log-list-section .sfdl-log-list-panel__org {
        display: block;
    }

    .sfdl-debug-logs__toolbar {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 8px 12px;
        background: #ffffff;
        border-bottom: 1px solid #dddbda;
    }

    .sfdl-debug-logs__hint {
        min-width: 0;
        color: #747474;
        font-size: 12px;
    }

    /* The editor column takes what the log list leaves, never the width of
       what it shows: a flex item would otherwise grow to fit a comparison. */
    .sfdl-body-tab > .slds-col {
        min-width: 0;
    }

    .sfdl-debug-logs__pair {
        display: block;
        height: 100%;
    }
`;
