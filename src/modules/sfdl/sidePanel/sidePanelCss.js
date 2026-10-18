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
        color: #3e3e3c;
        font-size: 12px;
        white-space: nowrap;
        writing-mode: vertical-rl;
        transform: rotate(180deg);
    }
`;
