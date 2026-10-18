export const css = `
    /* The tabs sit on a light grey strip. The open one takes the light blue
       of the panel headers and joins the toolbar of its tab, as light blue. */
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
        background: var(--sfdl-left-tint, #edf5fd);
        border-left-color: var(--sfdl-left-border, #b9d6f2);
        border-right-color: var(--sfdl-left-border, #b9d6f2);
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
        background: var(--sfdl-left-tint, #edf5fd);
        border-bottom: 1px solid var(--sfdl-left-border, #b9d6f2);
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
