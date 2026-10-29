export const css = `
    sfdl-live-events {
        display: block;
    }

    .sfdl-live-events {
        display: flex;
        flex-direction: column;
        gap: 12px;
        color: var(--sfdl-text, #16325c);
    }

    .sfdl-live-events__header {
        display: flex;
        align-items: center;
        gap: 12px;
    }

    .sfdl-live-events__back {
        flex: 0 0 auto;
        display: inline-flex;
        align-items: center;
        gap: 4px;
    }

    /* The slds glyph is white, the brand blue of the button text here. */
    .sfdl-live-events__back-icon {
        width: 12px;
        height: 12px;
        filter: brightness(0) saturate(100%) invert(31%) sepia(96%) saturate(1500%) hue-rotate(188deg) brightness(92%) contrast(101%);
    }

    .sfdl-live-events__titles {
        min-width: 0;
    }

    .sfdl-live-events__title {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
        line-height: 20px;
    }

    .sfdl-live-events__description {
        margin: 0;
        font-size: 12px;
        color: #747474;
    }

    /* The channel, start and stop on one line, copy and clear at its end. */
    .sfdl-live-events__controls {
        display: flex;
        flex-wrap: wrap;
        align-items: flex-end;
        gap: 8px;
    }

    .sfdl-live-events__channel {
        flex: 0 1 28rem;
        min-width: 14rem;
    }

    .sfdl-live-events__duration {
        flex: 0 0 9rem;
    }

    .sfdl-live-events__budget {
        margin: -8px 0 0;
        font-size: 12px;
        color: #747474;
    }

    .sfdl-live-events__spacer {
        flex: 1 1 auto;
    }

    .sfdl-live-events__controls .slds-button {
        line-height: 1.75rem;
        font-size: 12px;
    }

    .sfdl-live-events__status {
        margin: 0;
        font-size: 12px;
        color: #747474;
    }

    .sfdl-live-events__status_listening {
        color: var(--sfdl-identical-text, #22683e);
    }

    .sfdl-live-events__status_failed {
        color: #ba0517;
    }

    .sfdl-live-events__table {
        font-size: 12px;
    }

    .sfdl-live-events__table th {
        color: #747474;
        font-weight: 600;
    }

    .sfdl-live-events__table td {
        vertical-align: top;
        white-space: nowrap;
    }

    .sfdl-live-events__table .sfdl-live-events__payload {
        width: 100%;
        white-space: normal;
        overflow-wrap: anywhere;
    }

    .sfdl-live-events__payload-line,
    .sfdl-live-events__payload-text {
        font-family: Menlo, Monaco, Consolas, monospace;
        font-size: 11px;
    }

    .sfdl-live-events__payload-text {
        margin: 0;
        white-space: pre-wrap;
    }

    .sfdl-live-events__number {
        text-align: right;
        font-variant-numeric: tabular-nums;
    }

    .sfdl-live-events__more {
        display: block;
        padding: 0;
        border: none;
        background: none;
        color: #0176d3;
        font-size: 11px;
        cursor: pointer;
        text-decoration: underline;
    }

    .sfdl-live-events__empty {
        padding: 8px;
        color: #747474;
        text-align: center;
    }
`;
