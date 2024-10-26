export const css = `
    .slds-notify_container {
        left: 50%;
        opacity: 0;
        transform: translate(-50%, -10vh); 
        transition-properties: opacity transform;
        transition-duration: 0.25s;
    }

    .animation-in {
        opacity: 1;
        transform: translate(-50%, 0vh); 
    }

    .animation-out {
        opacity: 0;
        transform: translate(-50%, -10vh); 
        transition-properties: opacity transform;
        transition-duration: 0.8s;
    }

    .blip {
        opacity: 0;
        transition-properties: opacity;
        transition-duration: 0.4s;
    }
`;