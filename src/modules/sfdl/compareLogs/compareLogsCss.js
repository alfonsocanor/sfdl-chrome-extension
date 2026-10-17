export const css = `
    sfdl-compare-logs {
        display: block;
    }

    .sfdl-compare-logs {
        display: flex;
        flex-direction: column;
        background: #fafaf9;
    }

    .sfdl-compare-logs__toolbar {
        display: flex;
        flex: 0 0 auto;
        align-items: center;
        gap: 12px;
        padding: 8px 12px;
        background: #ffffff;
        border-bottom: 1px solid #dddbda;
    }

    .sfdl-compare-logs__hint {
        flex: 1 1 auto;
        min-width: 0;
        color: #747474;
        font-size: 12px;
    }

    .sfdl-compare-logs__actions {
        display: flex;
        flex: 0 0 auto;
        align-items: center;
        gap: 6px;
    }

    .sfdl-compare-logs__body {
        display: flex;
        flex: 1 1 auto;
        min-height: 0;
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
