export const css = `
    sfdl-skeleton {
        display: block;
    }

    .sfdl-skeleton ul {
        margin: 0;
        padding: 0;
        list-style: none;
    }

    .sfdl-skeleton .sfdl-skeleton__row {
        display: flex;
        align-items: center;
        gap: 6px;
    }

    .sfdl-skeleton .sfdl-skeleton__text {
        display: flex;
        flex: 1 1 auto;
        flex-direction: column;
        min-width: 0;
    }

    /* A light grey with a lighter shine running across, nothing strong. */
    .sfdl-skeleton .sfdl-skeleton__bone {
        display: block;
        border-radius: 0.25rem;
        background: linear-gradient(90deg, #ecebea 25%, #f6f5f4 37%, #ecebea 63%);
        background-size: 400% 100%;
        animation: sfdl-skeleton-shine 1.4s ease infinite;
    }

    .sfdl-skeleton .sfdl-skeleton__square {
        flex: 0 0 auto;
    }

    /* As high as a line of text, the bone a little less. */
    .sfdl-skeleton .sfdl-skeleton__line {
        height: 11px;
        margin: 4px 0;
    }

    @keyframes sfdl-skeleton-shine {
        0% {
            background-position: 100% 50%;
        }
        100% {
            background-position: 0 50%;
        }
    }

    @media (prefers-reduced-motion: reduce) {
        .sfdl-skeleton .sfdl-skeleton__bone {
            animation: none;
        }
    }
`;
