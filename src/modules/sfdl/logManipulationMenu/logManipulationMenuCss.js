export const css = `
    /* In a toolbar it keeps its width, the name of the log gives way. */
    sfdl-log-manipulation-menu {
        display: block;
        flex: 0 0 auto;
    }

    .sfdl-log-filters {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 4px;
    }

    .sfdl-log-filter {
        position: relative;
    }

    /* Off, a plain outline. On, the blue border with a light blue fill and the
       text as it was, nothing strong. */
    .sfdl-log-filters .sfdl-log-filter__pill {
        padding: 1px 8px;
        border: 1px solid var(--sfdl-neutral-border, #dddbda);
        border-radius: 0.25rem;
        background: #ffffff;
        color: var(--sfdl-text, #16325c);
        font-size: 12px;
        line-height: 18px;
        white-space: nowrap;
        cursor: pointer;
    }

    .sfdl-log-filters .sfdl-log-filter__pill:hover {
        background: #f3f3f3;
    }

    .sfdl-log-filters .sfdl-log-filter__pill.sfdl-log-filter__pill_on {
        background: #edf5fd;
        border-color: #0176d3;
        color: var(--sfdl-text, #16325c);
    }

    .sfdl-log-filters .sfdl-log-filter__pill.sfdl-log-filter__pill_on:hover {
        background: #d8e6fe;
    }

    /* Out of the layout while hidden, so it never widens the page. */
    .sfdl-log-filters .sfdl-log-filter__tooltip {
        position: absolute;
        top: calc(100% + 0.75rem);
        left: 0;
        display: none;
        width: max-content;
        max-width: 20rem;
        pointer-events: none;
    }

    .sfdl-log-filters .sfdl-log-filter:hover > .sfdl-log-filter__tooltip {
        display: block;
    }
`;
