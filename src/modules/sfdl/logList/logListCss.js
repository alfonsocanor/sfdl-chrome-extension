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
        width: 18px;
        height: 18px;
        padding: 2px;
        margin-left: 4px;
        opacity: 0.3;
        transition: opacity 0.2s ease-in-out;
    }

    .sfdl-log-row:hover .downloadSingleLogButton,
    .sfdl-log-row .downloadSingleLogButton:focus {
        opacity: 1;
    }

    .sfdl-log-checkbox {
        flex: 0 0 auto;
        margin: 0 6px 0 2px;
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
`;
