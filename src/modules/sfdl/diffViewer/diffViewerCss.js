export const css = `
    .sfdl-diff-viewer {
        display: flex;
        flex-direction: column;
        min-width: 0;
        background: #fafaf9;
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
