export const css = `
    /* The text of the whole console, in place of the near black of slds,
       dropdowns included since slds gives them a colour of their own. */
    html,
    .slds-dropdown {
        color: var(--sfdl-text, #16325c);
    }

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
        color: var(--sfdl-text, #16325c);
    }

    .sfdl-console-tabs .slds-is-active .slds-tabs_scoped__link,
    .sfdl-console-tabs .slds-is-active .slds-tabs_scoped__link:hover {
        background: var(--sfdl-left-tint, #edf5fd);
        border-left-color: var(--sfdl-left-border, #b9d6f2);
        border-right-color: var(--sfdl-left-border, #b9d6f2);
        color: var(--sfdl-text, #16325c);
    }

    /* The names of the tabs and of the modes of the logs in small capitals.
       The colour and the weight stay those of the tab or the button, so the
       open tab stays bold and a brand button white. */
    .sfdl-console-tabs .slds-text-title_caps,
    .sfdl-debug-logs__toolbar .slds-text-title_caps {
        color: inherit;
        font-weight: inherit;
    }

    /* A button lays its label out as a flex item, the label keeps the height
       of the button. */
    .sfdl-debug-logs__toolbar .slds-button .slds-text-title_caps {
        line-height: inherit;
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
`;
