import { createElement } from 'lwc';
import LoadingStencil from 'sfdl/loadingStencil';

function createStencil(properties = {}) {
    const element = createElement('sfdl-loading-stencil', {
        is: LoadingStencil
    });
    Object.assign(element, properties);
    document.body.appendChild(element);
    return element;
}

const all = (element, selector) => [
    ...element.shadowRoot.querySelectorAll(selector)
];
const status = (element) => element.shadowRoot.querySelector('.sfdl-stencil');

describe('sfdl-loading-stencil', () => {
    it('draws nothing for a type it does not know', () => {
        const element = createStencil({ type: 'notAType' });

        expect(element.shadowRoot.querySelector('*')).toBeNull();
    });

    it('says it is loading, its bones hidden from screen readers', () => {
        const element = createStencil({
            type: 'logList',
            label: 'Loading the logs'
        });

        expect(status(element).getAttribute('role')).toBe('status');
        expect(status(element).getAttribute('aria-busy')).toBe('true');
        expect(status(element).getAttribute('aria-label')).toBe(
            'Loading the logs'
        );
        expect(
            element.shadowRoot.querySelector('ul').getAttribute('aria-hidden')
        ).toBe('true');
    });

    describe('logList', () => {
        it('draws the actions of the list, then rows of a tick, two lines and an icon', () => {
            const element = createStencil({ type: 'logList', rows: 3 });
            const rows = all(element, '.sfdl-stencil-log-row');

            expect(
                element.shadowRoot.querySelector('.sfdl-stencil-actions')
            ).not.toBeNull();
            expect(rows).toHaveLength(3);
            expect(
                [...rows[0].children].map((bone) => bone.className)
            ).toEqual([
                'sfdl-shimmer sfdl-stencil__tick',
                'sfdl-stencil__lines',
                'sfdl-shimmer sfdl-stencil__icon'
            ]);
            expect(
                rows[0].querySelectorAll('.sfdl-stencil__line')
            ).toHaveLength(2);
        });

        it('draws eight rows unless asked for another count, before it can measure the room', () => {
            const element = createStencil({ type: 'logList' });

            expect(all(element, '.sfdl-stencil-log-row')).toHaveLength(8);
        });

        it('gives each row lines of its own length', () => {
            const element = createStencil({ type: 'logList', rows: 4 });
            const firstLines = all(element, '.sfdl-stencil-log-row').map(
                (row) => row.querySelector('.sfdl-stencil__line').style.width
            );

            expect(new Set(firstLines).size).toBeGreaterThan(1);
            firstLines.forEach((width) => {
                expect(parseInt(width, 10)).toBeGreaterThanOrEqual(58);
                expect(parseInt(width, 10)).toBeLessThanOrEqual(96);
            });
        });

        it('fills the room left under it down to what it scrolls in, and never scrolls it', async () => {
            const container = document.createElement('div');
            container.style.overflowY = 'auto';
            document.body.appendChild(container);
            const element = createElement('sfdl-loading-stencil', {
                is: LoadingStencil
            });
            element.type = 'logList';
            container.appendChild(element);
            const box = (top, height) => () => ({
                top,
                bottom: top + height,
                height
            });
            container.getBoundingClientRect = box(0, 500);
            status(element).getBoundingClientRect = box(10, 0);
            all(element, 'li').forEach((item, index) => {
                item.getBoundingClientRect = box(40 + index * 50, 42);
            });

            window.dispatchEvent(new Event('resize'));
            await Promise.resolve();

            // From the first row at 40 down to 500, a row every 50px.
            expect(all(element, 'li')).toHaveLength(10);
            expect(status(element).style.height).toBe('490px');
            expect(status(element).style.overflow).toBe('hidden');
        });
    });

    describe('compareLogList', () => {
        it('draws the count, then rows of two lines', () => {
            const element = createStencil({ type: 'compareLogList', rows: 2 });

            expect(
                element.shadowRoot.querySelector('.sfdl-stencil-count')
            ).not.toBeNull();
            expect(all(element, '.sfdl-stencil-log-row')).toHaveLength(2);
            expect(all(element, '.sfdl-stencil__tick')).toHaveLength(0);
        });

        it('draws a tick on each row for a list feeding both sides', () => {
            const element = createStencil({
                type: 'compareLogList',
                rows: 2,
                ticks: true
            });

            expect(all(element, '.sfdl-stencil__tick')).toHaveLength(2);
        });
    });

    describe('componentList', () => {
        it('draws the filters, the search, then rows of a badge and a name', () => {
            const element = createStencil({ type: 'componentList', rows: 4 });

            expect(
                all(element, '.sfdl-stencil-components__filter')
            ).toHaveLength(3);
            expect(
                element.shadowRoot.querySelector(
                    '.sfdl-stencil-components__search'
                )
            ).not.toBeNull();
            expect(all(element, '.sfdl-stencil-components__row')).toHaveLength(
                4
            );
            expect(
                all(element, '.sfdl-stencil-components__badge')
            ).toHaveLength(4);
        });
    });

    describe('log and diff', () => {
        it('draws one pane of a log, its lines stepping in and out', () => {
            const element = createStencil({ type: 'log', lines: 6 });
            const texts = all(element, '.sfdl-stencil-code__text');

            expect(all(element, '.sfdl-stencil-code__pane')).toHaveLength(1);
            expect(texts).toHaveLength(6);
            expect(texts[0].style.marginLeft).toBe('0rem');
            expect(texts[5].style.marginLeft).toBe('3rem');
            expect(all(element, '.sfdl-stencil-code__number')).toHaveLength(6);
        });

        it('draws the two panes of a diff, or one when asked', () => {
            const diff = createStencil({ type: 'diff', lines: 2 });
            const sidePane = createStencil({
                type: 'diff',
                lines: 2,
                panes: 1
            });

            expect(all(diff, '.sfdl-stencil-code__pane')).toHaveLength(2);
            expect(all(sidePane, '.sfdl-stencil-code__pane')).toHaveLength(1);
        });

        it('draws the lines alone, what is on its way only read out', () => {
            const element = createStencil({
                type: 'diff',
                label: 'Comparing Utils...'
            });

            expect(status(element).getAttribute('aria-label')).toBe(
                'Comparing Utils...'
            );
            expect(element.shadowRoot.querySelector('p')).toBeNull();
        });
    });
});
