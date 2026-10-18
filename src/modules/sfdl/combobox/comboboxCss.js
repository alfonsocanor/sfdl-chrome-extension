export const css = `
    sfdl-combobox {
        display: block;
    }

    .sfdl-combobox .sfdl-combobox-label {
        display: inline-flex;
        align-items: center;
    }

    .sfdl-combobox .sfdl-combobox-control_side {
        position: relative;
    }

    .sfdl-combobox .sfdl-combobox-control_left {
        --sfdl-combobox-side: var(--sfdl-left-swatch);
    }

    .sfdl-combobox .sfdl-combobox-control_right {
        --sfdl-combobox-side: var(--sfdl-right-swatch);
    }

    /* The colour of the side, a line thicker than a plain field. The inset
       shadow thickens it without making the field any higher. */
    .sfdl-combobox .sfdl-combobox-control_side .sfdl-combobox-button,
    .sfdl-combobox .sfdl-combobox-control_side .sfdl-combobox-button:focus {
        border-color: var(--sfdl-combobox-side);
        box-shadow: inset 0 0 0 1px var(--sfdl-combobox-side);
    }

    .sfdl-combobox .sfdl-combobox-control_side .sfdl-combobox-button:focus {
        box-shadow: inset 0 0 0 1px var(--sfdl-combobox-side), 0 0 3px #0176d3;
    }

    /* Right on hover, where the title of the browser takes its time. Out of
       the layout while hidden: a hidden one would still widen the page and
       turn its horizontal scrolling on. */
    .sfdl-combobox .sfdl-combobox-tooltip {
        position: absolute;
        top: calc(100% + 0.75rem);
        left: 0;
        display: none;
        width: max-content;
        pointer-events: none;
    }

    .sfdl-combobox .sfdl-combobox-tooltip.sfdl-combobox-tooltip_right {
        left: auto;
        right: 0;
    }

    .sfdl-combobox .sfdl-combobox-control_side:hover > .sfdl-combobox-tooltip {
        display: block;
    }

    .sfdl-combobox .sfdl-combobox-tooltip__label {
        font-weight: 700;
    }

    /* The badge of the step, the notification badge of slds a little larger,
       in the light green of identical rather than its alert red, nothing
       strong, on a white ring so it stands off the field. */
    .sfdl-combobox .sfdl-combobox-badge {
        border: 1px solid var(--sfdl-identical-border, #b7dfab);
        background: var(--sfdl-identical-tint, #ebf7e6);
        color: var(--sfdl-identical-text, #22683e);
        top: -0.5rem;
        right: -0.5rem;
        z-index: 1;
        min-width: 1.125rem;
        min-height: 1.125rem;
        font-size: 0.6875rem;
        font-weight: 700;
        line-height: 1;
        box-shadow: 0 0 0 2px #ffffff;
    }

    /* The step to take next breathes: a ring of its green swells and fades,
       again and again, after the ding it comes in with. */
    .sfdl-combobox .sfdl-combobox-badge.sfdl-combobox-badge_pulse {
        animation:
            ding 0.8s ease-out,
            sfdl-combobox-badge-pulse 1.8s ease-out 0.8s infinite;
    }

    @keyframes sfdl-combobox-badge-pulse {
        0% {
            box-shadow: 0 0 0 2px #ffffff, 0 0 0 2px rgba(34, 104, 62, 0.3);
        }
        70% {
            box-shadow: 0 0 0 2px #ffffff, 0 0 0 9px rgba(34, 104, 62, 0);
        }
        100% {
            box-shadow: 0 0 0 2px #ffffff, 0 0 0 9px rgba(34, 104, 62, 0);
        }
    }

    @media (prefers-reduced-motion: reduce) {
        .sfdl-combobox .sfdl-combobox-badge,
        .sfdl-combobox .sfdl-combobox-badge.sfdl-combobox-badge_pulse {
            animation: none;
        }
    }

    .sfdl-combobox .sfdl-combobox-button {
        width: 100%;
        text-align: left;
    }

    .sfdl-combobox .sfdl-combobox-placeholder {
        color: #747474;
    }

    .sfdl-combobox .slds-listbox__option.sfdl-combobox-option_selected {
        color: #0176d3;
        font-weight: 700;
    }

    .sfdl-combobox .sfdl-combobox-empty {
        color: #747474;
        cursor: default;
    }
`;
