import { createElement } from 'lwc';
import SidePanel from 'sfdl/sidePanel';

function flushPromises() {
    return Promise.resolve();
}

function createSidePanel(properties = {}) {
    const element = createElement('sfdl-side-panel', { is: SidePanel });
    Object.assign(element, { title: 'Left logs', ...properties });
    document.body.appendChild(element);
    return element;
}

const panel = (element) => element.shadowRoot.querySelector('.sfdl-side-panel');
const content = (element) =>
    element.shadowRoot.querySelector('.sfdl-side-panel__content');
const strip = (element) =>
    element.shadowRoot.querySelector('.sfdl-side-panel__strip');
const collapseButton = (element) =>
    element.shadowRoot.querySelector('.sfdl-side-panel__collapse');
const expandButton = (element) =>
    element.shadowRoot.querySelector('.sfdl-side-panel__expand');

function click(node) {
    node.dispatchEvent(new CustomEvent('click'));
}

describe('sfdl-side-panel', () => {
    it('shows its title, its subtitle and its content', () => {
        const element = createSidePanel({ subtitle: 'acme.my.salesforce.com' });

        expect(
            element.shadowRoot
                .querySelector('.slds-panel__header-title')
                .textContent.trim()
        ).toBe('Left logs');
        expect(
            element.shadowRoot.querySelector('.sfdl-side-panel__subtitle')
                .textContent
        ).toBe('acme.my.salesforce.com');
        expect(content(element).classList.contains('slds-hide')).toBe(false);
        expect(strip(element)).toBeNull();
    });

    it('takes the tint of its side', () => {
        const element = createSidePanel({ side: 'right' });

        expect(panel(element).classList.contains('sfdl-side-panel_right')).toBe(
            true
        );
        expect(
            panel(element).classList.contains('sfdl-side-panel_dock-right')
        ).toBe(true);
        expect(
            element.shadowRoot
                .querySelector('.slds-panel__header-title')
                .textContent.trim()
        ).toBe('Left logs');
    });

    it('stays neutral without a side', () => {
        const element = createSidePanel();

        expect(
            panel(element).classList.contains('sfdl-side-panel_dock-left')
        ).toBe(true);
        expect(panel(element).className).not.toMatch(
            /sfdl-side-panel_(left|right)\b/
        );
    });

    it('folds into a strip and opens again', async () => {
        const element = createSidePanel({ width: '22rem' });
        const handleToggle = jest.fn();
        element.addEventListener('toggle', handleToggle);

        expect(panel(element).style.width).toBe('22rem');

        click(collapseButton(element));
        await flushPromises();

        expect(handleToggle.mock.calls[0][0].detail).toEqual({
            collapsed: true
        });
        expect(content(element).classList.contains('slds-hide')).toBe(true);
        expect(strip(element).textContent.trim()).toBe('Left logs');
        expect(panel(element).style.width).toBe('2.5rem');

        click(expandButton(element));
        await flushPromises();

        expect(handleToggle.mock.calls[1][0].detail).toEqual({
            collapsed: false
        });
        expect(content(element).classList.contains('slds-hide')).toBe(false);
        expect(strip(element)).toBeNull();
    });

    it('can start collapsed', () => {
        const element = createSidePanel({ collapsed: true });

        expect(content(element).classList.contains('slds-hide')).toBe(true);
    });

    it('points its toggle icons towards the edge it is docked to', async () => {
        const left = createSidePanel({ side: 'left' });
        const right = createSidePanel({ side: 'right' });

        expect(collapseButton(left).querySelector('img').src).toContain(
            'toggle_panel_left'
        );
        expect(collapseButton(right).querySelector('img').src).toContain(
            'toggle_panel_right'
        );

        click(collapseButton(right));
        await flushPromises();

        expect(expandButton(right).querySelector('img').src).toContain(
            'toggle_panel_left'
        );
    });

    it('has room under its title for a header of its own', () => {
        const element = createSidePanel({ subtitle: 'acme.my.salesforce.com' });
        const titles = element.shadowRoot.querySelector(
            '.sfdl-side-panel__titles'
        );

        expect(
            [...titles.children].map((child) => child.tagName.toLowerCase())
        ).toEqual(['h2', 'p', 'slot']);
        expect(titles.querySelector('slot').getAttribute('name')).toBe(
            'header'
        );
    });

    it('gives its header to what it holds when it has no title', async () => {
        const element = createSidePanel({ title: undefined, label: 'Left org' });

        expect(
            element.shadowRoot.querySelector('.slds-panel__header-title')
        ).toBeNull();
        expect(panel(element).classList).toContain('sfdl-side-panel_untitled');
        expect(collapseButton(element).title).toBe('Collapse Left org');

        click(collapseButton(element));
        await flushPromises();

        expect(
            element.shadowRoot.querySelector('.sfdl-side-panel__strip-title')
                .textContent
        ).toBe('Left org');
    });

    describe('back to the top', () => {
        const body = (element) =>
            element.shadowRoot.querySelector('.sfdl-side-panel__body');
        const wrapper = (element) =>
            element.shadowRoot.querySelector('.sfdl-side-panel__back-to-top');
        const backToTopButton = (element) =>
            element.shadowRoot.querySelector(
                '.sfdl-side-panel__back-to-top-button'
            );

        function scrollBody(element, scrollTop, clientHeight = 400) {
            Object.defineProperty(body(element), 'clientHeight', {
                configurable: true,
                value: clientHeight
            });
            body(element).scrollTop = scrollTop;
            body(element).dispatchEvent(new CustomEvent('scroll'));
        }

        function nextFrame() {
            return new Promise((resolve) => setTimeout(resolve, 30));
        }

        it('has no way back to the top unless asked for one', () => {
            const element = createSidePanel();

            expect(wrapper(element)).toBeNull();
            expect(body(element).getAttribute('tabindex')).toBeNull();
        });

        it('stays hidden and out of the tab order near the top', async () => {
            const element = createSidePanel({ backToTop: true });

            scrollBody(element, 150);
            await nextFrame();

            expect(wrapper(element).classList).not.toContain(
                'sfdl-side-panel__back-to-top_visible'
            );
            expect(wrapper(element).getAttribute('aria-hidden')).toBe('true');
            expect(backToTopButton(element).getAttribute('tabindex')).toBe(
                '-1'
            );
        });

        it('rises once the list is scrolled half a panel down, and goes when the top is back', async () => {
            const element = createSidePanel({ backToTop: true });

            scrollBody(element, 260);
            await nextFrame();

            expect(wrapper(element).classList).toContain(
                'sfdl-side-panel__back-to-top_visible'
            );
            expect(wrapper(element).getAttribute('aria-hidden')).toBe('false');
            expect(backToTopButton(element).textContent.trim()).toBe(
                'Back to the top'
            );

            scrollBody(element, 0);
            await nextFrame();

            expect(wrapper(element).classList).not.toContain(
                'sfdl-side-panel__back-to-top_visible'
            );
        });

        it('glides back to the top, the list taking the focus', async () => {
            const element = createSidePanel({ backToTop: true });
            body(element).scrollTo = jest.fn();
            const focus = jest.spyOn(body(element), 'focus');
            scrollBody(element, 900);
            await nextFrame();

            backToTopButton(element).click();
            await flushPromises();

            expect(focus).toHaveBeenCalledWith({ preventScroll: true });
            expect(body(element).scrollTo).toHaveBeenCalledWith({
                top: 0,
                behavior: 'smooth'
            });
            expect(wrapper(element).classList).not.toContain(
                'sfdl-side-panel__back-to-top_visible'
            );
        });
    });
});
