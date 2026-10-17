export const css = `
    .sfdl-compare-log-list {
        display: flex;
        flex-direction: column;
        gap: 6px;
        min-height: 100%;
    }

    .sfdl-compare-log-list__toolbar {
        display: flex;
        align-items: center;
        gap: 6px;
    }

    .sfdl-compare-log-list__filter {
        flex: 1 1 auto;
        min-width: 0;
    }

    .sfdl-compare-log-list .sfdl-compare-log-list__filter-icon {
        width: 14px;
        height: 14px;
        margin-top: -7px;
    }

    .sfdl-compare-log-list__count {
        color: #747474;
        font-size: 12px;
    }

    .sfdl-compare-log-list__message {
        padding: 8px;
        color: #747474;
        text-align: center;
    }

    .sfdl-compare-log-list__message_error {
        color: #b33a3a;
    }

    .sfdl-compare-log-list__logs {
        position: relative;
        flex: 1 1 auto;
        min-height: 4rem;
    }

    /* The look of the analyse log rows, see logListCss. */
    .sfdl-compare-log-row {
        display: flex;
        align-items: center;
        width: 100%;
        gap: 6px;
        padding: 4px 6px;
        background: #fafaf9;
        border-radius: 0.25rem;
    }

    .sfdl-compare-log-row_left {
        background: var(--sfdl-left-tint);
        box-shadow: inset 3px 0 0 var(--sfdl-left-swatch);
    }

    .sfdl-compare-log-row_right {
        background: var(--sfdl-right-tint);
        box-shadow: inset 3px 0 0 var(--sfdl-right-swatch);
    }

    .sfdl-compare-log-row_both {
        background: linear-gradient(90deg, var(--sfdl-left-tint) 50%, var(--sfdl-right-tint) 50%);
        box-shadow: inset 3px 0 0 var(--sfdl-left-swatch), inset -3px 0 0 var(--sfdl-right-swatch);
    }

    .sfdl-compare-log-row .sfdl-compare-log-name {
        flex: 1 1 auto;
        min-width: 0;
        padding: 0;
        border: none;
        background: transparent;
        color: inherit;
        font: inherit;
        text-align: left;
        cursor: pointer;
        overflow-wrap: anywhere;
    }

    .sfdl-compare-log-row .sfdl-compare-log-name:focus {
        outline: none;
        text-decoration: underline;
    }

    .sfdl-compare-log-pill {
        flex: 0 0 auto;
        width: 20px;
        height: 18px;
        padding: 0;
        border: 1px solid var(--sfdl-neutral-border);
        border-radius: 0.25rem;
        background: #ffffff;
        color: #747474;
        font-size: 11px;
        line-height: 16px;
        text-align: center;
        cursor: pointer;
    }

    .sfdl-compare-log-pill:hover,
    .sfdl-compare-log-pill:focus {
        border-color: #747474;
        color: #3e3e3c;
    }

    .sfdl-compare-log-pill_left-active {
        background: var(--sfdl-left-tint);
        border-color: var(--sfdl-left-swatch);
        color: var(--sfdl-left-text);
        font-weight: 700;
    }

    .sfdl-compare-log-pill_right-active {
        background: var(--sfdl-right-tint);
        border-color: var(--sfdl-right-swatch);
        color: var(--sfdl-right-text);
        font-weight: 700;
    }
`;
