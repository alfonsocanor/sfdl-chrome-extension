export const css = `
    sfdl-monitoring {
        display: block;
    }

    .sfdl-monitoring {
        display: flex;
        flex-direction: column;
        background: #fafaf9;
    }

    /* The toolbar of the compare tabs, the org at its left. */
    .sfdl-monitoring__toolbar {
        display: flex;
        flex: 0 0 auto;
        align-items: flex-end;
        gap: 12px;
        padding: 8px 12px;
        background: var(--sfdl-left-tint, #edf5fd);
        border-bottom: 1px solid var(--sfdl-left-border, #b9d6f2);
    }

    .sfdl-monitoring__org {
        width: 17rem;
    }

    .sfdl-monitoring__refresh {
        flex: 0 0 auto;
        margin-bottom: 5px;
    }

    .sfdl-monitoring__hint {
        min-width: 0;
        margin-bottom: 8px;
        color: #747474;
        font-size: 12px;
    }

    /* The cards on the left, scrolling on their own, the panel of the limits
       docked to the right edge. */
    .sfdl-monitoring__body {
        display: flex;
        flex: 1 1 auto;
        min-height: 0;
    }

    .sfdl-monitoring__main {
        flex: 1 1 auto;
        min-width: 0;
        padding: 12px;
        overflow: auto;
    }

    .sfdl-monitoring__message {
        flex: 1 1 auto;
    }

    .sfdl-monitoring__meters-panel {
        display: block;
        flex: 0 0 auto;
        height: 100%;
    }

    .sfdl-monitoring__message {
        padding: 8px;
        color: #747474;
        text-align: center;
    }

    .sfdl-monitoring__sections {
        display: flex;
        flex-direction: column;
        gap: 16px;
    }

    .sfdl-monitoring__section-title {
        margin: 0 0 8px;
        font-size: 12px;
        font-weight: 600;
        letter-spacing: 0.0625rem;
        text-transform: uppercase;
        color: #747474;
    }

    /* As many cards to a row as fit, each at least 14rem wide. */
    .sfdl-monitoring__cards {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
        gap: 12px;
    }
`;
