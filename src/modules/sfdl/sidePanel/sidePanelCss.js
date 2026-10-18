export const css = `
    sfdl-side-panel {
        display: block;
        flex: 0 0 auto;
        height: 100%;
        min-height: 0;
    }

    .sfdl-side-panel {
        display: flex;
        flex: 0 0 auto;
        flex-direction: column;
        height: 100%;
        min-height: 0;
        background: #ffffff;
        transition: width 0.2s ease-in-out;
    }

    .sfdl-side-panel_dock-left {
        border-right: 1px solid #dddbda;
    }

    .sfdl-side-panel_dock-right {
        border-left: 1px solid #dddbda;
    }

    .sfdl-side-panel__content {
        display: flex;
        flex: 1 1 auto;
        flex-direction: column;
        min-height: 0;
    }

    /* The actions stay level with the title when the header holds more than
       a line, a picker under the title for instance. */
    .sfdl-side-panel .sfdl-side-panel__header {
        display: flex;
        flex: 0 0 auto;
        align-items: flex-start;
        gap: 8px;
        min-height: 52px;
        padding: 8px 12px;
    }

    /* What the header holds in place of a title sits level with the toggle. */
    .sfdl-side-panel_untitled .sfdl-side-panel__header {
        align-items: center;
    }

    .sfdl-side-panel_left .sfdl-side-panel__header {
        background: var(--sfdl-left-tint);
        border-bottom-color: var(--sfdl-left-border);
    }

    .sfdl-side-panel_right .sfdl-side-panel__header {
        background: var(--sfdl-right-tint);
        border-bottom-color: var(--sfdl-right-border);
    }

    .sfdl-side-panel__titles {
        flex: 1 1 auto;
        min-width: 0;
    }

    .sfdl-side-panel__titles .slds-panel__header-title {
        display: flex;
        align-items: center;
    }

    .sfdl-side-panel__subtitle {
        color: #747474;
        font-size: 12px;
    }

    .sfdl-side-panel__actions {
        display: flex;
        flex: 0 0 auto;
        align-items: center;
        gap: 6px;
    }

    .sfdl-side-panel__body {
        flex: 1 1 auto;
        min-height: 0;
        padding: 8px;
        overflow: auto;
        background: #fafaf9;
    }

    /* The list takes the focus from the button: no ring on a column. */
    .sfdl-side-panel__body:focus {
        outline: none;
    }

    /*
     * BACK TO THE TOP. The dock sits in the part of the panel that does not
     * scroll, at its foot, with no height and no pointer events, so the list
     * under it stays usable. The wrapper inside moves; the button keeps the
     * outline brand look of slds, on white so the rows do not show through,
     * with a soft lift under it.
     */
    .sfdl-side-panel__content {
        position: relative;
    }

    .sfdl-side-panel__back-to-top-dock {
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        height: 0;
        z-index: 2;
        pointer-events: none;
    }

    /* Hidden: sunk, shrunk, blurred and transparent, and not pressable. */
    .sfdl-side-panel__back-to-top {
        position: absolute;
        left: 50%;
        bottom: 0.75rem;
        border-radius: 0.25rem;
        background: #ffffff;
        box-shadow: 0 6px 18px rgba(1, 118, 211, 0.16), 0 1px 3px rgba(0, 0, 0, 0.08);
        white-space: nowrap;
        opacity: 0;
        filter: blur(3px);
        transform: translate(-50%, 0.75rem) scale(0.92);
        visibility: hidden;
        pointer-events: none;
        transition:
            opacity 220ms ease,
            filter 260ms ease,
            transform 320ms cubic-bezier(0.34, 1.56, 0.64, 1),
            visibility 0s linear 320ms;
    }

    /* Shown: rises into place with a small overshoot, sharp and pressable. */
    .sfdl-side-panel__back-to-top_visible {
        opacity: 1;
        filter: none;
        transform: translate(-50%, 0) scale(1);
        visibility: visible;
        pointer-events: auto;
        transition:
            opacity 220ms ease,
            filter 220ms ease,
            transform 320ms cubic-bezier(0.34, 1.56, 0.64, 1),
            visibility 0s linear 0s;
    }

    .sfdl-side-panel__back-to-top .sfdl-side-panel__back-to-top-button {
        gap: 6px;
        padding: 0 12px;
        line-height: 1.75rem;
        font-size: 12px;
    }

    .sfdl-side-panel__back-to-top-icon {
        width: 12px;
        height: 12px;
    }

    @media (prefers-reduced-motion: reduce) {
        .sfdl-side-panel__back-to-top,
        .sfdl-side-panel__back-to-top_visible {
            filter: none;
            transform: translate(-50%, 0);
            transition: opacity 150ms ease, visibility 0s linear 150ms;
        }

        .sfdl-side-panel__back-to-top_visible {
            transition: opacity 150ms ease, visibility 0s linear 0s;
        }
    }

    .sfdl-side-panel__strip {
        display: flex;
        flex: 1 1 auto;
        flex-direction: column;
        align-items: center;
        gap: 10px;
        padding-top: 14px;
        overflow: hidden;
    }

    .sfdl-side-panel_left .sfdl-side-panel__strip {
        background: var(--sfdl-left-tint);
    }

    .sfdl-side-panel_right .sfdl-side-panel__strip {
        background: var(--sfdl-right-tint);
    }

    .sfdl-side-panel__strip-title {
        color: var(--sfdl-text, #16325c);
        font-size: 12px;
        white-space: nowrap;
        writing-mode: vertical-rl;
        transform: rotate(180deg);
    }
`;
