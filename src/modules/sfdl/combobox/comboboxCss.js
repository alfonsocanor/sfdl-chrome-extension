export const css = `
    sfdl-combobox {
        display: block;
    }

    .sfdl-combobox .sfdl-combobox-label {
        display: inline-flex;
        align-items: center;
    }

    .sfdl-combobox .sfdl-combobox-control_side {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .sfdl-combobox .sfdl-combobox-control_side > .slds-combobox_container {
        flex: 1 1 auto;
        min-width: 0;
    }

    /* As high as the field next to it. */
    .sfdl-combobox .sfdl-combobox-swatch {
        position: relative;
        width: 2rem;
        height: 2rem;
        margin-right: 0;
        border-radius: 0.25rem;
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

    .sfdl-combobox .sfdl-combobox-swatch:hover > .sfdl-combobox-tooltip {
        visibility: visible;
        opacity: 1;
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
