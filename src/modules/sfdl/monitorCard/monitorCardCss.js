export const css = `
    sfdl-monitor-card {
        display: block;
        min-width: 0;
    }

    /* A white tile on the grey of the tab, the whole of it the button that
       opens its detail. The text keeps the text colour, the figure is what
       stands out, by its size. */
    .sfdl-monitor-card {
        display: flex;
        flex-direction: column;
        gap: 6px;
        width: 100%;
        min-height: 9rem;
        padding: 12px 14px;
        background: #ffffff;
        border: 1px solid var(--sfdl-neutral-border, #dddbda);
        border-radius: 0.25rem;
        color: var(--sfdl-text, #16325c);
        font: inherit;
        text-align: left;
        cursor: default;
        outline: none;
        user-select: text;
        transition: border-color 0.2s ease-in-out, box-shadow 0.2s ease-in-out;
    }

    .sfdl-monitor-card_openable {
        cursor: pointer;
    }

    /* The ring on hover, and on focus from the keyboard only: a click or a
       selection of its words leaves no ring behind. */
    .sfdl-monitor-card_openable:hover,
    .sfdl-monitor-card_openable:focus-visible {
        border-color: #0176d3;
        box-shadow: 0 0 0 1px #0176d3;
        outline: none;
    }

    .sfdl-monitor-card__label {
        font-size: 12px;
        color: #747474;
    }

    .sfdl-monitor-card__value {
        font-size: 28px;
        font-weight: 600;
        line-height: 32px;
    }

    .sfdl-monitor-card__caption {
        min-height: 12px;
        font-size: 12px;
        line-height: 12px;
        color: #747474;
    }

    /* The words of the severity on a badge, a dot beside them in the colour:
       the light green of identical when clear, the warning yellow when not,
       the blue of the left side for an overview. */
    .sfdl-monitor-card__severity {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        align-self: flex-start;
        margin-top: auto;
        padding: 0 8px;
        border: 1px solid;
        border-radius: 0.25rem;
        font-size: 11px;
        line-height: 16px;
        white-space: nowrap;
    }

    .sfdl-monitor-card__severity-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: currentColor;
    }

    .sfdl-monitor-card__severity_clear {
        background: var(--sfdl-identical-tint);
        border-color: var(--sfdl-identical-border);
        color: var(--sfdl-identical-text);
    }

    .sfdl-monitor-card__severity_alert {
        background: var(--sfdl-different-tint);
        border-color: var(--sfdl-different-border);
        color: var(--sfdl-different-text);
    }

    /* A figure that is there to be known, in the blue of the left side. */
    .sfdl-monitor-card__severity_info {
        background: var(--sfdl-left-tint);
        border-color: var(--sfdl-left-border);
        color: var(--sfdl-left-text);
    }

    /* An org without what the monitor needs: the tile in the grey of the
       tab, what it needs in the grey of a caption and a neutral badge. */
    .sfdl-monitor-card_unavailable {
        background: var(--sfdl-neutral-tint, #f3f3f3);
    }

    .sfdl-monitor-card__requires {
        font-size: 12px;
        line-height: 1.4;
        color: #747474;
    }

    .sfdl-monitor-card__severity_unavailable {
        background: #ffffff;
        border-color: var(--sfdl-neutral-border, #dddbda);
        color: var(--sfdl-neutral-text, #706e6b);
    }

    .sfdl-monitor-card__error {
        font-size: 12px;
        line-height: 1.4;
        color: #ba0517;
    }
`;
