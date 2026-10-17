export const css = `
    .sfdl-diff-viewer {
        display: flex;
        flex-direction: column;
        min-width: 0;
        background: #fafaf9;
    }

    .sfdl-diff-viewer .sfdl-diff-summary {
        display: flex;
        flex: 0 0 auto;
        align-items: center;
        gap: 8px;
        padding: 6px 8px;
        background: #ffffff;
        border-bottom: 1px solid #dddbda;
    }

    .sfdl-diff-viewer .sfdl-diff-summary__side {
        display: flex;
        flex: 1 1 0;
        min-width: 0;
    }

    .sfdl-diff-viewer .sfdl-diff-summary__side_right {
        justify-content: flex-end;
    }

    .sfdl-diff-viewer .sfdl-diff-summary__center {
        display: flex;
        flex: 0 0 auto;
        align-items: center;
        gap: 6px;
    }

    .sfdl-diff-viewer .sfdl-diff-count {
        min-width: 8.5rem;
        color: #3e3e3c;
        font-size: 12px;
        text-align: center;
    }

    .sfdl-diff-viewer .sfdl-diff-option {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        margin-left: 6px;
        color: #3e3e3c;
        font-size: 12px;
        cursor: pointer;
        white-space: nowrap;
    }

    .sfdl-diff-viewer .sfdl-diff-option input {
        width: 14px;
        height: 14px;
        margin: 0;
        cursor: pointer;
    }

    .sfdl-diff-viewer .sfdl-diff-banner {
        flex: 0 0 auto;
        padding: 6px 12px;
        border-bottom: 1px solid;
        font-size: 12px;
    }

    .sfdl-diff-viewer .sfdl-diff-banner_identical {
        background: #ebf7e6;
        border-color: #b7dfab;
        color: #22683e;
    }

    .sfdl-diff-viewer .sfdl-diff-banner_notice {
        background: #f3f3f3;
        border-color: #dddbda;
        color: #3e3e3c;
    }

    .sfdl-diff-viewer .sfdl-diff-body {
        position: relative;
        flex: 1 1 auto;
        min-height: 0;
    }

    .sfdl-diff-viewer .sfdl-diff-editor {
        position: absolute;
        top: 0;
        right: 0;
        bottom: 0;
        left: 0;
    }

    .sfdl-diff-viewer .sfdl-diff-empty {
        position: absolute;
        top: 0;
        right: 0;
        bottom: 0;
        left: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1rem;
        color: #747474;
        text-align: center;
    }
`;
