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

    .sfdl-log-row {
        display: flex;
        align-items: center;
        width: 100%;
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
        padding: 2px;
        margin-left: 4px;
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
        margin: 0 6px;
        cursor: pointer;
    }

    .sfdl-log-list-actions {
        display: flex;
        align-items: center;
    }

    .sfdl-log-list-actions .sfdl-download-label {
        flex: 1 1 auto;
        min-width: 0;
    }

    .sfdl-clear-selection {
        flex: 0 0 auto;
        margin-right: 8px;
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
