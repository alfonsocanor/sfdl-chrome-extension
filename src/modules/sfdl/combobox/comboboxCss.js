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

    /* Right on hover, where the title of the browser takes its time. */
    .sfdl-combobox .sfdl-combobox-tooltip {
        position: absolute;
        top: calc(100% + 0.75rem);
        left: 0;
        width: max-content;
        visibility: hidden;
        opacity: 0;
        transition: opacity 0.1s;
        pointer-events: none;
    }

    .sfdl-combobox .sfdl-combobox-control_side:hover > .sfdl-combobox-tooltip {
        visibility: visible;
        opacity: 1;
    }

    .sfdl-combobox .sfdl-combobox-tooltip__label {
        font-weight: 700;
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
