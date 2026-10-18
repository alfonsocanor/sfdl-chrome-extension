export const css = `
    sfdl-combobox {
        display: block;
    }

    .sfdl-combobox .sfdl-combobox-label {
        display: inline-flex;
        align-items: center;
    }

    .sfdl-combobox .sfdl-combobox-control_left,
    .sfdl-combobox .sfdl-combobox-control_right {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .sfdl-combobox .sfdl-combobox-control_right {
        flex-direction: row-reverse;
    }

    .sfdl-combobox .sfdl-combobox-control_left > .slds-combobox_container,
    .sfdl-combobox .sfdl-combobox-control_right > .slds-combobox_container {
        flex: 1 1 auto;
        min-width: 0;
    }

    .sfdl-combobox .sfdl-combobox-swatch {
        width: 16px;
        height: 16px;
        margin-right: 0;
        border-radius: 3px;
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
