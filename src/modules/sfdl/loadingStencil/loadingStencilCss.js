export const css = `
    /*
     * THE STENCILS. Every measure here is copied from the thing each one stands
     * for: the log rows from logListCss and compareLogListCss, the component
     * rows from compareResultsCss, the code from the editor. If they move
     * there, move them here.
     */
    sfdl-loading-stencil {
        display: block;
    }

    .sfdl-stencil ul {
        margin: 0;
        padding: 0;
        list-style: none;
    }

    /* ── shared bones ─────────────────────────────────────────────────────── */

    .sfdl-stencil .sfdl-stencil__tick {
        flex: 0 0 auto;
        width: 14px;
        height: 14px;
        border-radius: 0.125rem;
    }

    .sfdl-stencil .sfdl-stencil__icon {
        flex: 0 0 auto;
        width: 18px;
        height: 18px;
    }

    /* Two lines of text, each as high as a line of the name, the bone a
       little less. */
    .sfdl-stencil .sfdl-stencil__lines {
        display: flex;
        flex: 1 1 auto;
        flex-direction: column;
        min-width: 0;
    }

    .sfdl-stencil .sfdl-stencil__line {
        height: 10px;
        margin: 5px 0;
    }

    /* ── the log lists (.sfdl-log-row, .sfdl-compare-log-row) ─────────────── */

    .sfdl-stencil .sfdl-stencil-log-row {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 4px 6px;
        background: #fafaf9;
        border-radius: 0.25rem;
    }

    /* .sfdl-log-list-actions, its label as long as Download all logs. */
    .sfdl-stencil .sfdl-stencil-actions {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 0.75rem;
        padding-left: 7px;
    }

    .sfdl-stencil .sfdl-stencil-actions__label {
        width: 6.5rem;
        height: 10px;
    }

    /* .sfdl-compare-log-list__count, as long as 4 logs. */
    .sfdl-stencil .sfdl-stencil-count {
        display: block;
        width: 2.75rem;
        height: 9px;
        margin: 4px 0 8px;
    }

    /* ── the components (sfdl-compare-results) ────────────────────────────── */

    .sfdl-stencil.sfdl-stencil-components {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .sfdl-stencil .sfdl-stencil-components__filters {
        display: flex;
        gap: 4px;
    }

    .sfdl-stencil .sfdl-stencil-components__filter {
        width: 2.5rem;
        height: 20px;
    }

    .sfdl-stencil .sfdl-stencil-components__filter_wide {
        width: 4.25rem;
    }

    .sfdl-stencil .sfdl-stencil-components__search {
        display: block;
        height: 32px;
    }

    .sfdl-stencil .sfdl-stencil-components__list {
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    .sfdl-stencil .sfdl-stencil-components__row {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 6px;
        border-radius: 0.25rem;
        background: #ffffff;
    }

    .sfdl-stencil .sfdl-stencil-components__badge {
        flex: 0 0 auto;
        width: 3.5rem;
        height: 18px;
    }

    .sfdl-stencil .sfdl-stencil-components__name {
        height: 10px;
    }

    /* ── the editor, one pane or the two of a diff ────────────────────────── */

    .sfdl-stencil.sfdl-stencil-code {
        display: flex;
        flex-direction: column;
        height: 100%;
        overflow: hidden;
        background: #ffffff;
    }

    .sfdl-stencil .sfdl-stencil-code__panes {
        display: flex;
        flex: 1 1 auto;
        min-height: 0;
    }

    .sfdl-stencil .sfdl-stencil-code__pane {
        flex: 1 1 0;
        min-width: 0;
        padding-top: 4px;
        overflow: hidden;
    }

    .sfdl-stencil .sfdl-stencil-code__pane + .sfdl-stencil-code__pane {
        border-left: 1px solid #e5e5e5;
    }

    /* A line of the editor: its number in the gutter, then its text. */
    .sfdl-stencil .sfdl-stencil-code__line {
        display: flex;
        align-items: center;
        height: 18px;
    }

    .sfdl-stencil .sfdl-stencil-code__number {
        flex: 0 0 auto;
        width: 14px;
        height: 8px;
        margin: 0 18px 0 22px;
    }

    .sfdl-stencil .sfdl-stencil-code__text {
        flex: 0 1 auto;
        height: 9px;
    }

    /* ── the shimmer, light, nothing strong ───────────────────────────────── */

    /* A step darker than the light grey the rows sit on, or a bone would not
       read against them. */
    .sfdl-stencil .sfdl-shimmer {
        position: relative;
        display: block;
        overflow: hidden;
        border-radius: 0.25rem;
        background: #e9e8e6;
    }

    .sfdl-stencil .sfdl-shimmer::before {
        position: absolute;
        content: "";
        width: 100%;
        height: 100%;
        background-image: linear-gradient(
            to right,
            #e9e8e6 0%,
            #dddbd8 20%,
            #e9e8e6 40%,
            #e9e8e6 100%
        );
        background-repeat: no-repeat;
        background-size: 450px 400px;
        animation: sfdl-shimmer 1.2s linear infinite;
    }

    @keyframes sfdl-shimmer {
        0% {
            background-position: -450px 0;
        }
        100% {
            background-position: 450px 0;
        }
    }

    @media (prefers-reduced-motion: reduce) {
        .sfdl-stencil .sfdl-shimmer::before {
            animation: none;
        }
    }
`;
