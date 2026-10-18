export const css = `
    .slds-is-open {
        opacity: 1;
        min-width:0px;

        @starting-style {
            width: 0px;
            min-width:0px;
            opacity: 0;
        }

        transition-property: display, opacity, width;
        transition-duration: 0.6s;
        transition-behavior: allow-discrete;
    }
    
    .log-list-is-closed {
        display: none;
        width: 0px;
        min-width:0px;
        opacity: 0;
        transition-property: display, opacity, width;
        transition-duration: 0.6s;
        transition-behavior: allow-discrete;
    }

    .sfdl-debug-logs__toolbar {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 8px 12px;
        background: #ffffff;
        border-bottom: 1px solid #dddbda;
    }

    .sfdl-debug-logs__hint {
        min-width: 0;
        color: #747474;
        font-size: 12px;
    }

    .sfdl-debug-logs__pair {
        height: 100%;
    }
`;
