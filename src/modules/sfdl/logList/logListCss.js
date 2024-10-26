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
`;