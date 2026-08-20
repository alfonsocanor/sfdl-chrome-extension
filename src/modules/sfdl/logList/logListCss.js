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

    .sfdl-log-row .downloadSingleLogButton {
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
        opacity: 0.3;
        transition: opacity 0.2s ease-in-out;
    }

    .sfdl-log-row:hover .downloadSingleLogButton,
    .sfdl-log-row .downloadSingleLogButton:focus {
        opacity: 1;
    }

    /* The slds icon files are white shapes, which used to be readable only
       because slds-is-selected painted the button #0176d3 behind them. Without
       that chip they have to be recoloured here: invert(54.5%) turns #ffffff
       into the #747474 slds uses for its icons. */
    .sfdl-log-row .downloadSingleLogButton img,
    .sfdl-log-list-actions .downloadLogsButton img {
        display: block;
        width: 100%;
        height: 100%;
        margin: 0 auto;
        filter: invert(54.5%);
    }

    .sfdl-log-row:hover .downloadSingleLogButton img,
    .sfdl-log-list-actions .downloadLogsButton:hover img {
        filter: invert(70%);
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

    /* Both download controls sit on the background of the panel and of the log
       line, rather than on a filled chip of their own. */
    .sfdl-log-list-actions .downloadLogsButton {
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
    }

    .sfdl-log-list-actions .sfdl-download-label {
        flex: 1 1 auto;
        min-width: 0;
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
