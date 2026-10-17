export const css = `
    sfdl-compare-orgs {
        display: block;
    }

    .sfdl-compare-orgs {
        display: flex;
        flex-direction: column;
        background: #fafaf9;
    }

    .sfdl-compare-orgs__toolbar {
        display: flex;
        flex: 0 0 auto;
        flex-wrap: wrap;
        align-items: flex-end;
        gap: 8px 12px;
        padding: 8px 12px;
        background: #ffffff;
        border-bottom: 1px solid #dddbda;
    }

    .sfdl-compare-orgs__org {
        width: 17rem;
    }

    .sfdl-compare-orgs__type {
        width: 15rem;
    }

    .sfdl-compare-orgs__toolbar-button {
        margin-bottom: 5px;
    }

    .sfdl-compare-orgs__managed {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        margin-bottom: 7px;
        color: #3e3e3c;
        font-size: 12px;
        cursor: pointer;
        white-space: nowrap;
    }

    .sfdl-compare-orgs__managed input {
        width: 14px;
        height: 14px;
        margin: 0;
        cursor: pointer;
    }

    .sfdl-compare-orgs__body {
        display: flex;
        flex: 1 1 auto;
        min-height: 0;
    }

    .sfdl-compare-orgs__progress {
        display: flex;
        flex-direction: column;
        gap: 4px;
        margin-bottom: 8px;
        padding: 6px 8px;
        border: 1px solid var(--sfdl-neutral-border);
        border-radius: 0.25rem;
        background: #ffffff;
        font-size: 12px;
    }

    .sfdl-compare-orgs__progress-row {
        display: flex;
        align-items: center;
        gap: 6px;
        min-width: 0;
    }

    .sfdl-compare-orgs__progress-org {
        flex: 1 1 auto;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .sfdl-compare-orgs__progress-status {
        flex: 0 1 auto;
        min-width: 0;
        color: #747474;
        text-align: right;
    }

    .sfdl-compare-orgs__progress-status_error {
        color: #b33a3a;
    }

    .sfdl-compare-orgs__progress-status_warning {
        color: #8c4b02;
    }

    .sfdl-compare-orgs__error {
        margin-bottom: 8px;
        color: #b33a3a;
    }

    .sfdl-compare-orgs__hint {
        padding: 8px;
        color: #747474;
        text-align: center;
    }

    .sfdl-compare-orgs__diff {
        flex: 1 1 auto;
        min-width: 0;
        height: 100%;
    }

    .sfdl-compare-orgs__diff sfdl-diff-viewer {
        height: 100%;
    }
`;
