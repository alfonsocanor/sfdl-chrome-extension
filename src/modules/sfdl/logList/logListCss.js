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
       instead of a different margin on each of them. */
    .sfdl-log-row {
        display: flex;
        align-items: center;
        width: 100%;
        gap: 6px;
    }

    .sfdl-log-row .displayLogButton {
        flex: 1 1 auto;
        min-width: 0;
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

    .sfdl-log-row .downloadSingleLogButton img {
        display: block;
        width: 100%;
        height: 100%;
        margin: 0 auto;
    }

    .sfdl-log-row:hover .downloadSingleLogButton,
    .sfdl-log-row .downloadSingleLogButton:focus {
        opacity: 1;
    }

    .sfdl-log-checkbox {
        flex: 0 0 auto;
        display: block;
        width: 14px;
        height: 14px;
        margin: 0;
        cursor: pointer;
    }

    .sfdl-log-list-actions {
        display: flex;
        align-items: center;
        gap: 6px;
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

    .sfdl-log-list-actions .downloadLogsButton img {
        display: block;
        width: 100%;
        height: 100%;
        margin: 0 auto;
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
