export const css = `
    sfdl-diff-viewer {
        display: block;
        min-width: 0;
    }

    .sfdl-diff-viewer {
        display: flex;
        flex-direction: column;
        min-width: 0;
        background: #fafaf9;
    }

    /* The height of a chip, so the bar holds it before the sides have one. */
    .sfdl-diff-viewer .sfdl-diff-summary {
        display: flex;
        flex: 0 0 auto;
        align-items: center;
        min-height: 39px;
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

    .sfdl-diff-viewer .sfdl-diff-summary__side {
        align-items: center;
        gap: 6px;
    }

    .sfdl-diff-viewer .sfdl-diff-summary__side_right {
        justify-content: flex-end;
    }

    /* The names of the sides lead the bar, a step under the org pickers. */
    .sfdl-diff-viewer .sfdl-diff-summary .sfdl-side-chip {
        padding: 2px 8px;
        font-size: 13px;
        line-height: 20px;
    }

    .sfdl-diff-viewer .sfdl-diff-summary .sfdl-side-swatch {
        width: 10px;
        height: 10px;
    }

    /* What the org of the side is doing, next to its name. */
    .sfdl-diff-viewer .sfdl-diff-side-status {
        flex: 0 1 auto;
        min-width: 0;
        overflow: hidden;
        color: #747474;
        font-size: 12px;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .sfdl-diff-viewer .sfdl-diff-side-status_error {
        color: #b33a3a;
    }

    .sfdl-diff-viewer .sfdl-diff-side-status_warning {
        color: #8c4b02;
    }

    .sfdl-diff-viewer .sfdl-diff-summary__center {
        display: flex;
        flex: 0 1 auto;
        align-items: center;
        gap: 6px;
        min-width: 0;
    }

    .sfdl-diff-viewer .sfdl-diff-summary__center > * {
        flex: 0 0 auto;
    }

    .sfdl-diff-viewer .sfdl-diff-summary__actions {
        display: flex;
        align-items: center;
        gap: 6px;
    }

    .sfdl-diff-viewer .sfdl-diff-summary__actions:not(:empty) {
        margin-right: 10px;
    }

    .sfdl-diff-viewer .sfdl-diff-count {
        min-width: 8.5rem;
        color: var(--sfdl-text, #16325c);
        font-size: 12px;
        text-align: center;
    }

    /* The green of identical, as a pill that gives way, ellipsis and all,
       before the names of the sides do. */
    .sfdl-diff-viewer .sfdl-diff-summary__center > .sfdl-diff-count_identical {
        flex: 0 1 auto;
        min-width: 8.5rem;
        max-width: 36rem;
        padding: 1px 8px;
        overflow: hidden;
        border: 1px solid var(--sfdl-identical-border);
        border-radius: 0.25rem;
        background: var(--sfdl-identical-tint);
        color: var(--sfdl-identical-text);
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .sfdl-diff-viewer .sfdl-diff-option {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        margin-left: 6px;
        color: var(--sfdl-text, #16325c);
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

    .sfdl-diff-viewer .sfdl-diff-banner_notice {
        background: #f3f3f3;
        border-color: #dddbda;
        color: var(--sfdl-text, #16325c);
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

    /* Over the pane of the side being loaded again only, opaque so what it
       holds meanwhile does not show. */
    .sfdl-diff-viewer .sfdl-diff-side-loading {
        position: absolute;
        top: 0;
        bottom: 0;
        z-index: 20;
        background: #fafaf9;
    }

    /* The stencil of the diff over the whole body, above the editor. */
    .sfdl-diff-viewer .sfdl-diff-stencil {
        position: absolute;
        top: 0;
        right: 0;
        bottom: 0;
        left: 0;
        z-index: 20;
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
