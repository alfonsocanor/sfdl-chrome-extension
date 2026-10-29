export const css = `
    sfdl-monitor-meters {
        display: block;
    }

    /* In the panel of the limits, no frame of its own. */
    .sfdl-monitor-meters {
        color: var(--sfdl-text, #16325c);
    }

    .sfdl-monitor-meters__header {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 6px;
    }

    .sfdl-monitor-meters__summary {
        margin: 0;
        font-size: 12px;
        line-height: 1.4;
        color: #747474;
    }

    /* The badge of the cards, see monitorCardCss. */
    .sfdl-monitor-meters__severity {
        display: inline-flex;
        flex: 0 0 auto;
        align-items: center;
        gap: 6px;
        padding: 0 8px;
        border: 1px solid;
        border-radius: 0.25rem;
        font-size: 11px;
        line-height: 16px;
        white-space: nowrap;
    }

    .sfdl-monitor-meters__severity-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: currentColor;
    }

    .sfdl-monitor-meters__severity_clear {
        background: var(--sfdl-identical-tint);
        border-color: var(--sfdl-identical-border);
        color: var(--sfdl-identical-text);
    }

    .sfdl-monitor-meters__severity_alert {
        background: var(--sfdl-different-tint);
        border-color: var(--sfdl-different-border);
        color: var(--sfdl-different-text);
    }

    .sfdl-monitor-meters__search {
        margin-top: 10px;
    }

    .sfdl-monitor-meters__search .slds-input {
        height: 28px;
        line-height: 28px;
        font-size: 12px;
    }

    .sfdl-monitor-meters__search-icon {
        width: 14px;
        height: 14px;
    }

    .sfdl-monitor-meters__search-clear {
        width: 20px;
        height: 20px;
    }

    .sfdl-monitor-meters__search-clear img {
        width: 10px;
        height: 10px;
        filter: brightness(0.45);
    }

    /* One meter under another. Each is its name, its figure at the right
       and a bar under them, the fill on a lighter step of its own blue, red
       once the limit is one to look at. */
    .sfdl-monitor-meters__list {
        display: flex;
        flex-direction: column;
        gap: 10px;
        margin: 12px 0 0;
        padding: 0;
        list-style: none;
    }

    .sfdl-monitor-meters__unused-toggle {
        display: block;
        margin-top: 12px;
        padding: 0;
        border: none;
        background: none;
        color: #0176d3;
        font-size: 12px;
        cursor: pointer;
        text-decoration: underline;
    }

    .sfdl-monitor-meters__unused-toggle:hover,
    .sfdl-monitor-meters__unused-toggle:focus {
        color: #014486;
        outline: none;
    }

    .sfdl-monitor-meters__meter {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 2px 8px;
        align-items: baseline;
        font-size: 12px;
    }

    .sfdl-monitor-meters__name {
        min-width: 0;
    }

    .sfdl-monitor-meters__figure {
        color: #747474;
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
    }

    .sfdl-monitor-meters__meter_alert .sfdl-monitor-meters__figure {
        color: #ba0517;
    }

    .sfdl-monitor-meters__track {
        grid-column: 1 / -1;
        display: block;
        height: 8px;
        background: var(--sfdl-left-tint, #edf5fd);
        border-radius: 4px;
        overflow: hidden;
    }

    .sfdl-monitor-meters__fill {
        display: block;
        height: 100%;
        min-width: 2px;
        background: var(--sfdl-left-swatch, #5a9be0);
        border-radius: 4px;
        transition: width 0.3s ease-out;
    }

    .sfdl-monitor-meters__fill_alert {
        background: #ba0517;
    }

    .sfdl-monitor-meters__error {
        margin: 12px 0 0;
        font-size: 12px;
        color: #ba0517;
    }

    .sfdl-monitor-meters__empty {
        margin: 12px 0 0;
        color: #747474;
        text-align: center;
    }
`;
