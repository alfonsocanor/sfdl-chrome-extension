export const css = `
    .sfdl-modal .slds-modal__title {
        color: var(--sfdl-text, #16325c);
    }

    .sfdl-modal__content {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        color: var(--sfdl-text, #16325c);
    }

    /* The slds utility glyphs are white, so each sits on a disc in the colour
       of what it says: the alert red of slds for a warning and an error, the
       brand blue for a note. */
    .sfdl-modal__icon {
        display: flex;
        flex: 0 0 auto;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        border-radius: 50%;
    }

    .sfdl-modal__icon img {
        width: 18px;
        height: 18px;
    }

    .sfdl-modal__icon_warning,
    .sfdl-modal__icon_error {
        background: #ba0517;
    }

    .sfdl-modal__icon_info {
        background: #0176d3;
    }

    .sfdl-modal__message {
        flex: 1 1 auto;
        min-width: 0;
        margin: 0;
        line-height: 1.5;
        white-space: pre-line;
    }
`;
