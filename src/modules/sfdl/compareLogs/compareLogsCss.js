export const css = `
    sfdl-compare-logs {
        display: block;
    }

    .sfdl-compare-logs {
        display: flex;
        flex-direction: column;
        background: #fafaf9;
    }

    .sfdl-compare-logs__body {
        display: flex;
        flex: 1 1 auto;
        min-height: 0;
    }

    .sfdl-compare-logs .sfdl-compare-logs__org-picker {
        margin-bottom: 8px;
    }

    .sfdl-compare-logs__diff {
        flex: 1 1 auto;
        min-width: 0;
        height: 100%;
    }

    .sfdl-compare-logs__diff sfdl-diff-viewer {
        height: 100%;
    }
`;
