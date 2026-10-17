import { adoptStyleSheet } from 'sfdl/styleSheets';

//One set of light tints for everything the compare tabs show: whatever comes
//from the left side is blue and whatever comes from the right side is amber,
//from the panel headers down to the highlighted lines of the diff.
export const SIDE_COLORS = {
    left: { tint: '#edf5fd', border: '#b9d6f2', text: '#0b5cab', swatch: '#5a9be0' },
    right: { tint: '#fdf5ea', border: '#efd3a8', text: '#8c4b02', swatch: '#e3a04f' }
};

export const css = `
    :root {
        --sfdl-left-tint: ${SIDE_COLORS.left.tint};
        --sfdl-left-border: ${SIDE_COLORS.left.border};
        --sfdl-left-text: ${SIDE_COLORS.left.text};
        --sfdl-left-swatch: ${SIDE_COLORS.left.swatch};
        --sfdl-right-tint: ${SIDE_COLORS.right.tint};
        --sfdl-right-border: ${SIDE_COLORS.right.border};
        --sfdl-right-text: ${SIDE_COLORS.right.text};
        --sfdl-right-swatch: ${SIDE_COLORS.right.swatch};
        --sfdl-different-tint: #f3f1fb;
        --sfdl-different-border: #d7d0f0;
        --sfdl-different-text: #5a4a9e;
        --sfdl-neutral-tint: #f3f3f3;
        --sfdl-neutral-border: #dddbda;
        --sfdl-neutral-text: #706e6b;
    }

    .sfdl-side-swatch {
        display: inline-block;
        flex: 0 0 auto;
        width: 8px;
        height: 8px;
        margin-right: 6px;
        border-radius: 2px;
        vertical-align: middle;
    }

    .sfdl-side-swatch_left {
        background: var(--sfdl-left-swatch);
    }

    .sfdl-side-swatch_right {
        background: var(--sfdl-right-swatch);
    }

    .sfdl-side-chip {
        display: inline-flex;
        align-items: center;
        min-width: 0;
        max-width: 100%;
        padding: 1px 6px;
        border: 1px solid;
        border-radius: 0.25rem;
        font-size: 12px;
        line-height: 18px;
    }

    .sfdl-side-chip > span {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .sfdl-side-chip_left {
        background: var(--sfdl-left-tint);
        border-color: var(--sfdl-left-border);
        color: var(--sfdl-left-text);
    }

    .sfdl-side-chip_right {
        background: var(--sfdl-right-tint);
        border-color: var(--sfdl-right-border);
        color: var(--sfdl-right-text);
    }

    /* slds has no swap glyph: its sort arrows, turned on their side, point
       to both sides. */
    .sfdl-swap-icon {
        transform: rotate(90deg);
    }

    .sfdl-status-badge {
        display: inline-block;
        flex: 0 0 auto;
        padding: 0 6px;
        border: 1px solid;
        border-radius: 0.25rem;
        font-size: 11px;
        line-height: 16px;
        white-space: nowrap;
    }

    .sfdl-status-badge_different {
        background: var(--sfdl-different-tint);
        border-color: var(--sfdl-different-border);
        color: var(--sfdl-different-text);
    }

    .sfdl-status-badge_left {
        background: var(--sfdl-left-tint);
        border-color: var(--sfdl-left-border);
        color: var(--sfdl-left-text);
    }

    .sfdl-status-badge_right {
        background: var(--sfdl-right-tint);
        border-color: var(--sfdl-right-border);
        color: var(--sfdl-right-text);
    }

    .sfdl-status-badge_identical {
        background: var(--sfdl-neutral-tint);
        border-color: var(--sfdl-neutral-border);
        color: var(--sfdl-neutral-text);
    }
`;

export function adoptCompareTheme(){
    adoptStyleSheet(css);
}
