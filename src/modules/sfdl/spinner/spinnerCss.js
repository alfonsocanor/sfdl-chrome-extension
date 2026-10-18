export const css = `
    /* Under the spinner, which slds centres in its container, so the two
       never sit on top of each other. */
    .sfdl-spinner__message {
        position: absolute;
        top: calc(50% + 1.5rem);
        right: 0;
        left: 0;
        padding: 0 1rem;
        color: #3e3e3c;
        text-align: center;
    }
`;
