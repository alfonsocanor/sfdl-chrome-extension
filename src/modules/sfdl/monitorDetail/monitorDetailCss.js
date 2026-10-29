export const css = `
    sfdl-monitor-detail {
        display: block;
    }

    .sfdl-monitor-detail {
        display: flex;
        flex-direction: column;
        gap: 12px;
        color: var(--sfdl-text, #16325c);
    }

    .sfdl-monitor-detail__header {
        display: flex;
        align-items: center;
        gap: 12px;
    }

    .sfdl-monitor-detail__back {
        flex: 0 0 auto;
        display: inline-flex;
        align-items: center;
        gap: 4px;
    }

    /* The slds glyph is white, the brand blue of the button text here. */
    .sfdl-monitor-detail__back-icon {
        width: 12px;
        height: 12px;
        filter: brightness(0) saturate(100%) invert(31%) sepia(96%) saturate(1500%) hue-rotate(188deg) brightness(92%) contrast(101%);
    }

    .sfdl-monitor-detail__titles {
        min-width: 0;
    }

    .sfdl-monitor-detail__title {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
        line-height: 20px;
    }

    .sfdl-monitor-detail__summary {
        margin: 0;
        font-size: 12px;
        color: #747474;
    }

    .sfdl-monitor-detail__description {
        margin: 0;
        font-size: 12px;
        color: #747474;
    }

    .sfdl-monitor-detail__groupings {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
    }

    .sfdl-monitor-detail__grouping {
        line-height: 1.5rem;
        font-size: 12px;
    }

    /* One series, so one hue: thin bars, 4px rounded at the data end and
       square at the baseline, the count at the tip in the text colour. */
    .sfdl-monitor-detail__bars {
        display: flex;
        flex-direction: column;
        gap: 6px;
        margin: 0;
        padding: 12px 14px;
        list-style: none;
        background: #ffffff;
        border: 1px solid var(--sfdl-neutral-border, #dddbda);
        border-radius: 0.25rem;
    }

    /* A bar plays the button that lists its items: the whole row of it,
       label, track and count, with the hand and a ring on focus, its words
       still there to select. */
    .sfdl-monitor-detail__bar-row {
        display: flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
        user-select: text;
    }

    .sfdl-monitor-detail__bar-row:focus-visible,
    .sfdl-monitor-detail__day:focus-visible {
        outline: 2px solid #0176d3;
        outline-offset: 2px;
    }

    /* The bar picked keeps its colour, the others fade until it is let go. */
    .sfdl-monitor-detail__group_dimmed .sfdl-monitor-detail__bar,
    .sfdl-monitor-detail__group_dimmed .sfdl-monitor-detail__column {
        opacity: 0.35;
    }

    .sfdl-monitor-detail__group_selected .sfdl-monitor-detail__bar-label,
    .sfdl-monitor-detail__group_selected .sfdl-monitor-detail__column-label {
        font-weight: 600;
    }

    .sfdl-monitor-detail__bar-label {
        flex: 0 0 11rem;
        font-size: 12px;
    }

    .sfdl-monitor-detail__bar-track {
        flex: 1 1 auto;
        min-width: 0;
        height: 14px;
    }

    .sfdl-monitor-detail__bar {
        display: block;
        height: 100%;
        min-width: 2px;
        background: var(--sfdl-left-swatch, #5a9be0);
        border-radius: 0 4px 4px 0;
        transition: width 0.3s ease-out;
    }

    .sfdl-monitor-detail__bar-count {
        flex: 0 0 2.5rem;
        font-size: 12px;
        font-variant-numeric: tabular-nums;
    }

    /* Over days: a column a day on one baseline, thin, 4px rounded at the
       cap and square at the baseline, the count on the cap and the day under
       it in the text colour. An empty day keeps its slot, so the gaps show. */
    .sfdl-monitor-detail__timeline {
        padding: 12px 14px 8px;
        background: #ffffff;
        border: 1px solid var(--sfdl-neutral-border, #dddbda);
        border-radius: 0.25rem;
    }

    /* No gap between the slots, so their baselines join into one; a few
       days keep to the left rather than spread over the whole width. */
    .sfdl-monitor-detail__columns {
        display: flex;
        align-items: stretch;
        height: 160px;
        margin: 0;
        padding: 0;
        list-style: none;
    }

    .sfdl-monitor-detail__day {
        display: flex;
        flex: 1 1 0;
        flex-direction: column;
        align-items: center;
        min-width: 0;
        max-width: 72px;
        cursor: pointer;
        user-select: text;
    }

    .sfdl-monitor-detail__day_empty {
        cursor: default;
    }

    .sfdl-monitor-detail__column-count {
        flex: 0 0 auto;
        height: 16px;
        font-size: 11px;
        line-height: 16px;
        font-variant-numeric: tabular-nums;
    }

    .sfdl-monitor-detail__column-track {
        display: flex;
        flex: 1 1 auto;
        align-items: flex-end;
        justify-content: center;
        width: 100%;
        border-bottom: 1px solid var(--sfdl-neutral-border, #dddbda);
    }

    .sfdl-monitor-detail__column {
        display: block;
        width: 60%;
        max-width: 24px;
        min-height: 2px;
        background: var(--sfdl-left-swatch, #5a9be0);
        border-radius: 4px 4px 0 0;
        transition: height 0.3s ease-out;
    }

    .sfdl-monitor-detail__day_empty .sfdl-monitor-detail__column {
        min-height: 0;
    }

    .sfdl-monitor-detail__column-label {
        flex: 0 0 auto;
        max-width: 100%;
        overflow: hidden;
        height: 16px;
        margin-top: 4px;
        font-size: 11px;
        line-height: 16px;
        color: #747474;
        white-space: nowrap;
    }

    /* The filter, the bar picked, the count of rows and the CSV on one
       line above the table, wrapping on a narrow window. */
    .sfdl-monitor-detail__filters {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
    }

    .sfdl-monitor-detail__search {
        flex: 0 1 18rem;
        min-width: 10rem;
    }

    .sfdl-monitor-detail__search-input {
        height: 1.75rem;
        min-height: 1.75rem;
        font-size: 12px;
    }

    .sfdl-monitor-detail__search-icon {
        width: 12px;
        height: 12px;
    }

    .sfdl-monitor-detail__search-clear img,
    .sfdl-monitor-detail__selection-clear img {
        width: 10px;
        height: 10px;
    }

    /* The bar picked, as a chip of the blue of the bars with an X that lets
       it go. */
    .sfdl-monitor-detail__selection {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        max-width: 22rem;
        min-width: 0;
        padding: 1px 4px 1px 8px;
        background: var(--sfdl-left-tint, #edf5fd);
        border: 1px solid var(--sfdl-left-border, #b9d6f2);
        border-radius: 0.25rem;
        color: var(--sfdl-left-text, #0b5cab);
        font-size: 12px;
        line-height: 18px;
    }

    .sfdl-monitor-detail__selection-clear {
        display: inline-flex;
        flex: 0 0 auto;
        padding: 3px;
        border: none;
        border-radius: 0.25rem;
        background: none;
        cursor: pointer;
    }

    .sfdl-monitor-detail__selection-clear:hover,
    .sfdl-monitor-detail__selection-clear:focus {
        background: var(--sfdl-left-border, #b9d6f2);
        outline: none;
    }

    .sfdl-monitor-detail__row-count {
        font-size: 12px;
        color: #747474;
        font-variant-numeric: tabular-nums;
    }

    .sfdl-monitor-detail__copy {
        margin-left: auto;
        line-height: 1.5rem;
        font-size: 12px;
    }

    .sfdl-monitor-detail__csv {
        margin-left: 0;
        line-height: 1.5rem;
        font-size: 12px;
    }

    .sfdl-monitor-detail__table {
        font-size: 12px;
    }

    .sfdl-monitor-detail__table .sfdl-monitor-detail__cell_actions {
        width: 1%;
        max-width: none;
        white-space: nowrap;
        text-align: right;
    }

    /* The words of an action on one line, Turn on as much as Download. */
    .sfdl-monitor-detail__action {
        line-height: 1.25rem;
        font-size: 11px;
        white-space: nowrap;
    }

    .sfdl-monitor-detail__more-rows {
        align-self: center;
        padding: 4px 8px;
        border: none;
        background: none;
        color: #0176d3;
        font-size: 12px;
        cursor: pointer;
        text-decoration: underline;
    }

    .sfdl-monitor-detail__more-rows:hover,
    .sfdl-monitor-detail__more-rows:focus {
        color: #014486;
        outline: none;
    }

    .sfdl-monitor-detail__table th {
        color: #747474;
        font-weight: 600;
    }

    /* The text of a cell is what is cut short, so the more under it keeps
       its own line. */
    .sfdl-monitor-detail__table td {
        max-width: 24rem;
        vertical-align: top;
    }

    .sfdl-monitor-detail__table .sfdl-monitor-detail__cell-text {
        display: block;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .sfdl-monitor-detail__cell_expanded .sfdl-monitor-detail__cell-text {
        white-space: pre-wrap;
        overflow-wrap: anywhere;
    }

    .sfdl-monitor-detail__more {
        display: block;
        padding: 0;
        border: none;
        background: none;
        color: #0176d3;
        font-size: 11px;
        cursor: pointer;
        text-decoration: underline;
    }

    .sfdl-monitor-detail__more:hover,
    .sfdl-monitor-detail__more:focus {
        color: #014486;
        outline: none;
    }

    .sfdl-monitor-detail__cell_number {
        text-align: right;
        font-variant-numeric: tabular-nums;
    }

    .sfdl-monitor-detail__row_alert td {
        background: var(--sfdl-different-tint);
    }

    /* The meter of a limit: the fill on a lighter step of its own blue, red
       once the limit is one to look at. */
    .sfdl-monitor-detail__cell_meter {
        min-width: 10rem;
    }

    .sfdl-monitor-detail__table .sfdl-monitor-detail__cell_meter .sfdl-monitor-detail__cell-text {
        display: inline-block;
        width: 3rem;
        font-variant-numeric: tabular-nums;
    }

    .sfdl-monitor-detail__meter {
        display: inline-block;
        width: calc(100% - 3.5rem);
        height: 8px;
        margin-right: 0.5rem;
        vertical-align: middle;
        background: var(--sfdl-left-tint, #edf5fd);
        border-radius: 4px;
        overflow: hidden;
    }

    .sfdl-monitor-detail__meter-fill {
        display: block;
        height: 100%;
        background: var(--sfdl-left-swatch, #5a9be0);
        border-radius: 4px;
    }

    .sfdl-monitor-detail__meter-fill_alert {
        background: #ba0517;
    }

    .sfdl-monitor-detail__empty {
        padding: 8px;
        color: #747474;
        text-align: center;
    }
`;
