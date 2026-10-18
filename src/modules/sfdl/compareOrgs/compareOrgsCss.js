export const css = `
    sfdl-compare-orgs {
        display: block;
    }

    .sfdl-compare-orgs {
        display: flex;
        flex-direction: column;
        background: #fafaf9;
    }

    /* The left org on the left edge, the right org on the right edge, as the
       sides of the diff below them. */
    .sfdl-compare-orgs__toolbar {
        display: flex;
        flex: 0 0 auto;
        align-items: flex-end;
        justify-content: space-between;
        gap: 12px;
        padding: 8px 12px;
        background: #ffffff;
        border-bottom: 1px solid #dddbda;
    }

    .sfdl-compare-orgs__org {
        width: 17rem;
    }

    /* Under the Components title, in the header of the panel. */
    .sfdl-compare-orgs .sfdl-compare-orgs__type {
        margin-top: 6px;
    }

    .sfdl-compare-orgs__body {
        display: flex;
        flex: 1 1 auto;
        min-height: 0;
    }

    /* A strip at the top of the diff: the left org on the left half, the
       right org on the right half, each status right after its org. */
    .sfdl-compare-orgs__progress {
        display: flex;
        flex: 0 0 auto;
        gap: 16px;
        padding: 6px 12px;
        background: #ffffff;
        border-bottom: 1px solid #dddbda;
        font-size: 12px;
    }

    .sfdl-compare-orgs__progress-row {
        display: flex;
        flex: 1 1 0;
        align-items: center;
        gap: 6px;
        min-width: 0;
    }

    .sfdl-compare-orgs__progress-org {
        flex: 0 1 auto;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .sfdl-compare-orgs__progress-status {
        flex: 0 1 auto;
        min-width: 0;
        overflow: hidden;
        color: #747474;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .sfdl-compare-orgs__progress-status::before {
        content: '·';
        margin-right: 6px;
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
        display: flex;
        flex: 1 1 auto;
        flex-direction: column;
        min-width: 0;
        height: 100%;
    }

    .sfdl-compare-orgs__diff sfdl-diff-viewer {
        flex: 1 1 auto;
        min-height: 0;
    }
`;
