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
`;