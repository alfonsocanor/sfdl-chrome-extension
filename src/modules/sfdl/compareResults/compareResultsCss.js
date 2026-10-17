export const css = `
    sfdl-compare-results {
        display: block;
    }

    .sfdl-compare-results {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .sfdl-compare-results__summary {
        padding: 6px 10px;
        border: 1px solid var(--sfdl-neutral-border);
        border-radius: 0.25rem;
        background: var(--sfdl-neutral-tint);
        color: #3e3e3c;
        font-size: 12px;
    }

    .sfdl-compare-results__summary_identical {
        background: #ebf7e6;
        border-color: #b7dfab;
        color: #22683e;
    }

    .sfdl-compare-results__filters {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
    }

    .sfdl-compare-results .sfdl-status-filter {
        padding: 1px 6px;
        border: 1px solid var(--sfdl-neutral-border);
        border-radius: 0.25rem;
        background: #ffffff;
        color: #3e3e3c;
        font-size: 11px;
        line-height: 16px;
        cursor: pointer;
    }

    .sfdl-compare-results .sfdl-status-filter_active {
        border-color: #747474;
        font-weight: 700;
        box-shadow: inset 0 -2px 0 #747474;
    }

    .sfdl-compare-results__search-icon {
        width: 14px;
        height: 14px;
        margin-top: -7px;
    }

    .sfdl-compare-results__empty {
        padding: 8px;
        color: #747474;
        text-align: center;
    }

    .sfdl-compare-results__list {
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    .sfdl-compare-results__actions {
        display: flex;
        align-items: center;
        gap: 6px;
        padding-left: 7px;
    }

    .sfdl-compare-results__actions input,
    .sfdl-compare-results__checkbox {
        flex: 0 0 auto;
        width: 14px;
        height: 14px;
        margin: 0;
        cursor: pointer;
    }

    .sfdl-compare-results .sfdl-compare-results__compare {
        min-height: 0;
        padding: 0 10px;
        font-size: 12px;
        line-height: 24px;
    }

    .sfdl-compare-results__cost {
        min-width: 0;
        color: #747474;
        font-size: 11px;
    }

    /* The look of the log rows: a checkbox, then what the row opens. */
    .sfdl-compare-results .sfdl-compare-results__row {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 4px 6px;
        border: 1px solid transparent;
        border-radius: 0.25rem;
        background: #ffffff;
    }

    .sfdl-compare-results .sfdl-compare-results__row:hover {
        border-color: var(--sfdl-neutral-border);
    }

    .sfdl-compare-results .sfdl-compare-results__row_selected {
        border-color: #747474;
        box-shadow: 0 0 0 3px #006bff40;
    }

    .sfdl-compare-results .sfdl-compare-results__open,
    .sfdl-compare-results .sfdl-compare-results__file {
        display: flex;
        flex: 1 1 auto;
        align-items: center;
        gap: 6px;
        min-width: 0;
        padding: 0;
        border: none;
        background: transparent;
        color: inherit;
        font: inherit;
        text-align: left;
        cursor: pointer;
    }

    .sfdl-compare-results .sfdl-compare-results__open:focus,
    .sfdl-compare-results .sfdl-compare-results__file:focus {
        outline: none;
        text-decoration: underline;
    }

    .sfdl-compare-results__name {
        min-width: 0;
        overflow-wrap: anywhere;
    }

    .sfdl-compare-results__files {
        display: flex;
        flex-direction: column;
        gap: 2px;
        margin: 2px 0 4px 26px;
    }

    .sfdl-compare-results .sfdl-compare-results__file {
        padding: 2px 6px;
        border-radius: 0.25rem;
        font-size: 12px;
    }

    .sfdl-compare-results .sfdl-compare-results__file_selected {
        background: #ffffff;
        box-shadow: 0 0 0 2px #006bff40;
    }

    .sfdl-status-badge_pending {
        background: #ffffff;
        border-color: var(--sfdl-neutral-border);
        color: var(--sfdl-neutral-text);
    }

    .sfdl-compare-results .sfdl-compare-results__more {
        padding: 4px;
        border: none;
        background: none;
        color: #0176d3;
        font-size: 12px;
        text-decoration: underline;
        cursor: pointer;
    }
`;
