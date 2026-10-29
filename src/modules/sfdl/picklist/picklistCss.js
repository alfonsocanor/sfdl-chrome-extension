export const css = `
    /* The org takes the width of the log list, its two buttons beside it. */
    .sfdl-picklist {
        display: flex;
        align-items: center;
        gap: 6px;
    }

    .sfdl-picklist .sfdl-picklist__org {
        flex: 1 1 auto;
        min-width: 0;
    }

    /* The buttons keep their width, and the filter is a box of its own so
       its width can be drawn, see the switch of the modes in consoleCss. */
    .sfdl-picklist .actionButtons,
    .sfdl-picklist sfdl-log-query-filter {
        flex: 0 0 auto;
    }

    .sfdl-picklist sfdl-log-query-filter {
        display: block;
    }

    /* The look of the org pickers of the compare tabs, the blue of the left
       side and a line thicker than a plain field. */
    .sfdl-picklist .slds-combobox__input,
    .sfdl-picklist .slds-combobox__input:focus {
        border-color: var(--sfdl-left-swatch);
        box-shadow: inset 0 0 0 1px var(--sfdl-left-swatch);
    }

    .sfdl-picklist .slds-combobox__input:focus {
        box-shadow: inset 0 0 0 1px var(--sfdl-left-swatch), 0 0 3px #0176d3;
    }

    /* One line per org, wider than the field when a name needs it. It opens
       from the left edge of the field and grows to the right, where the log
       details have room, never past the left edge of the window. */
    .sfdl-picklist .slds-dropdown.slds-dropdown_fluid {
        width: max-content;
        min-width: 100%;
        max-width: 24rem;
    }

    .sfdl-picklist .slds-listbox__option {
        white-space: nowrap;
    }
`;
