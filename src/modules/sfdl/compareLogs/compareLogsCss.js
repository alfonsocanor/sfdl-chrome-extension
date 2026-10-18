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

    .sfdl-compare-logs__diff {
        display: flex;
        flex: 1 1 auto;
        flex-direction: column;
        min-width: 0;
        height: 100%;
    }

    .sfdl-compare-logs__filters {
        flex: 0 0 auto;
        padding: 6px 8px;
        background: #ffffff;
        border-bottom: 1px solid #dddbda;
    }

    .sfdl-compare-logs__diff sfdl-diff-viewer {
        flex: 1 1 0;
        min-height: 0;
    }
`;
