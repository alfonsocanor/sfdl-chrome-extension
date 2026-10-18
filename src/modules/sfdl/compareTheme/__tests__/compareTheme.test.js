import { css } from 'sfdl/compareTheme';

const rule = (selector) => {
    const start = css.indexOf(selector + ' {');
    return css.slice(start, css.indexOf('}', start));
};

describe('compareTheme', () => {
    it('paints what both orgs hold alike in green', () => {
        expect(css).toContain('--sfdl-identical-tint: #ebf7e6;');
        expect(rule('.sfdl-status-badge_identical')).toContain(
            'var(--sfdl-identical-tint)'
        );
    });

    it('paints what they hold differently in a warning yellow, apart from the amber of the right side', () => {
        expect(css).toContain('--sfdl-different-tint: #fdf3d1;');
        expect(rule('.sfdl-status-badge_different')).toContain(
            'var(--sfdl-different-tint)'
        );
        expect(rule('.sfdl-status-badge_different')).not.toContain(
            '--sfdl-right'
        );
    });
});
