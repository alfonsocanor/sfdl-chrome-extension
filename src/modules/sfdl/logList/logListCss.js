export const css = `    
    .custom-animation {
        opacity: 0;
        transform: translateY(-10px);
        animation: logdisplay 0.5s forwards;
    }

    @keyframes logdisplay {
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }

    /* One gap owns the spacing between the checkbox, the log name and the icon,
       instead of a different margin on each of them. slds-item carries no
       padding of its own, so the row supplies it. */
    .sfdl-log-row {
        display: flex;
        align-items: center;
        width: 100%;
        gap: 6px;
        padding: 4px 6px;
        background: #fafaf9;
        border-radius: 0.25rem;
    }

    /* A bare button paints the browser default button-face grey. The row owns
       the background, so the log name has to be see through. */
    .sfdl-log-row .displayLogButton {
        flex: 1 1 auto;
        min-width: 0;
        padding: 0;
        background: transparent;
        cursor: pointer;
    }

    .sfdl-log-row .displayLogButton:focus {
        outline: none;
    }

    .sfdl-log-row .downloadSingleLogButton,
    .sfdl-log-row .deleteSingleLogButton {
        flex: 0 0 auto;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 18px;
        height: 18px;
        padding: 0;
        background: transparent;
        border: none;
        box-shadow: none;
        cursor: pointer;
        opacity: 0.7;
        transition: opacity 0.2s ease-in-out;
    }

    .sfdl-log-row .downloadSingleLogButton:hover,
    .sfdl-log-row .downloadSingleLogButton:focus,
    .sfdl-log-row .deleteSingleLogButton:hover,
    .sfdl-log-row .deleteSingleLogButton:focus {
        opacity: 1;
    }

    .sfdl-log-row .downloadSingleLogButton img,
    .sfdl-log-row .deleteSingleLogButton img {
        display: block;
        width: 100%;
        height: 100%;
        margin: 0 auto;
    }



    .sfdl-log-checkbox {
        flex: 0 0 auto;
        display: block;
        width: 14px;
        height: 14px;
        margin: 0;
        cursor: pointer;
    }

    /* 6px to match the row padding, plus the 1px border of slds-item, so the
       select all checkbox lines up with the checkbox of every row below it. */
    .sfdl-log-list-actions {
        display: flex;
        align-items: center;
        gap: 6px;
        padding-left: 7px;
    }

    /* The icon and the count are one control: clicking either starts the same
       action, download or delete, and both go blue together on hover. */
    .sfdl-log-list-actions .sfdl-log-list-action {
        flex: 0 1 auto;
        display: flex;
        align-items: center;
        gap: 6px;
        min-width: 0;
        padding: 0;
        background: transparent;
        border: none;
        box-shadow: none;
        cursor: pointer;
        font: inherit;
        text-align: left;
    }

    .sfdl-log-list-action__icon {
        flex: 0 0 auto;
        display: block;
        width: 18px;
        height: 18px;
        /* The glyph file is #0176d3, so grey is the resting state and hover
           just drops the filter to get the blue back. */
        filter: grayscale(1) brightness(1.15);
    }

    .sfdl-log-list-actions .sfdl-log-list-action:hover .sfdl-log-list-action__icon,
    .sfdl-log-list-actions .sfdl-log-list-action:focus .sfdl-log-list-action__icon {
        filter: none;
    }

    .sfdl-log-list-actions .sfdl-log-list-action:hover .sfdl-log-list-action__label,
    .sfdl-log-list-actions .sfdl-log-list-action:focus .sfdl-log-list-action__label {
        color: #0176d3;
        text-decoration: underline;
    }

    .sfdl-log-list-actions .sfdl-log-list-action__label {
        flex: 0 1 auto;
        min-width: 0;
        color: #747474;
    }

    .sfdl-log-list__message {
        padding: 8px;
        color: #747474;
        text-align: center;
    }

    .sfdl-clear-selection {
        flex: 0 0 auto;
        padding: 0;
        border: none;
        background: none;
        color: #0176d3;
        cursor: pointer;
        text-decoration: underline;
        font-size: 12px;
    }

    .sfdl-clear-selection:hover,
    .sfdl-clear-selection:focus {
        color: #014486;
    }
`;
