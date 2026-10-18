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
                .querySelector('.sfdl-side-swatch')
                .classList.contains('sfdl-side-swatch_right')
        ).toBe(true);
    });

    it('stays neutral without a side', () => {
        const element = createSidePanel();

        expect(
            panel(element).classList.contains('sfdl-side-panel_dock-left')
        ).toBe(true);
        expect(
            element.shadowRoot.querySelector('.sfdl-side-swatch')
        ).toBeNull();
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
});
