import { createElement } from 'lwc';
import Combobox from 'sfdl/combobox';

const OPTIONS = [
    { label: 'Apex Classes', value: 'ApexClass', group: 'Code' },
    {
        label: 'Lightning Web Components',
        value: 'LightningComponentBundle',
        group: 'User interface'
    },
    { label: 'Apex Triggers', value: 'ApexTrigger', group: 'Code' }
];

function flushPromises() {
    return Promise.resolve();
}

function createCombobox(properties = {}) {
    const element = createElement('sfdl-combobox', { is: Combobox });
    Object.assign(element, {
        label: 'Metadata',
        options: OPTIONS,
        ...properties
    });
    document.body.appendChild(element);
    return element;
}

const button = (element) =>
    element.shadowRoot.querySelector('.sfdl-combobox-button');
const combobox = (element) =>
    element.shadowRoot.querySelector('.slds-combobox');
const options = (element) => [
    ...element.shadowRoot.querySelectorAll('[role="option"]')
];
const groupHeaders = (element) =>
    [
        ...element.shadowRoot.querySelectorAll('.slds-listbox__option-header')
    ].map((header) => header.textContent);

function click(node) {
    node.dispatchEvent(
        new CustomEvent('click', { bubbles: true, composed: true })
    );
}

function pressKey(node, key) {
    const event = new CustomEvent('keydown', {
        bubbles: true,
        composed: true,
        cancelable: true
    });
    event.key = key;
    node.dispatchEvent(event);
}

describe('sfdl-combobox', () => {
    it('shows the placeholder until an option is picked', () => {
        const element = createCombobox({ placeholder: 'Pick a type' });

        expect(button(element).textContent.trim()).toBe('Pick a type');
        expect(
            button(element)
                .querySelector('span')
                .classList.contains('sfdl-combobox-placeholder')
        ).toBe(true);
    });

    it('shows the label of the selected value', () => {
        const element = createCombobox({ value: 'ApexTrigger' });

        expect(button(element).textContent.trim()).toBe('Apex Triggers');
    });

    it('lists the options under the header of their group', async () => {
        const element = createCombobox();

        click(button(element));
        await flushPromises();

        expect(combobox(element).classList.contains('slds-is-open')).toBe(true);
        expect(groupHeaders(element)).toEqual(['Code', 'User interface']);
        expect(
            options(element).map((option) => option.textContent.trim())
        ).toEqual([
            'Apex Classes',
            'Apex Triggers',
            'Lightning Web Components'
        ]);
    });

    it('tells the parent which option was picked and closes', async () => {
        const element = createCombobox();
        const handleChange = jest.fn();
        element.addEventListener('change', handleChange);

        click(button(element));
        await flushPromises();
        click(options(element)[1]);
        await flushPromises();

        expect(handleChange).toHaveBeenCalledTimes(1);
        expect(handleChange.mock.calls[0][0].detail).toEqual({
            value: 'ApexTrigger',
            option: OPTIONS[2]
        });
        expect(button(element).textContent.trim()).toBe('Apex Triggers');
        expect(combobox(element).classList.contains('slds-is-open')).toBe(
            false
        );
    });

    it('stays quiet when the selected option is picked again', async () => {
        const element = createCombobox({ value: 'ApexClass' });
        const handleChange = jest.fn();
        element.addEventListener('change', handleChange);

        click(button(element));
        await flushPromises();
        click(options(element)[0]);

        expect(handleChange).not.toHaveBeenCalled();
    });

    it('marks the selected option', async () => {
        const element = createCombobox({ value: 'ApexTrigger' });

        click(button(element));
        await flushPromises();

        expect(
            options(element).map((option) =>
                option.getAttribute('aria-selected')
            )
        ).toEqual(['false', 'true', 'false']);
    });

    it('closes when the focus leaves it', async () => {
        const element = createCombobox();

        click(button(element));
        await flushPromises();
        button(element).dispatchEvent(new CustomEvent('blur'));
        await flushPromises();

        expect(combobox(element).classList.contains('slds-is-open')).toBe(
            false
        );
    });

    it('keeps the focus on the button while the list is clicked', () => {
        const element = createCombobox();
        const mousedown = new CustomEvent('mousedown', {
            bubbles: true,
            cancelable: true
        });

        element.shadowRoot
            .querySelector('.slds-dropdown')
            .dispatchEvent(mousedown);

        expect(mousedown.defaultPrevented).toBe(true);
    });

    it('is driven from the keyboard in the order the options are listed', async () => {
        const element = createCombobox();
        const handleChange = jest.fn();
        element.addEventListener('change', handleChange);

        pressKey(button(element), 'ArrowDown');
        pressKey(button(element), 'ArrowDown');
        pressKey(button(element), 'ArrowDown');
        await flushPromises();

        expect(combobox(element).classList.contains('slds-is-open')).toBe(true);
        expect(options(element)[2].classList.contains('slds-has-focus')).toBe(
            true
        );

        pressKey(button(element), 'ArrowDown');
        pressKey(button(element), 'ArrowUp');
        pressKey(button(element), 'Enter');

        expect(handleChange.mock.calls[0][0].detail.value).toBe(
            'LightningComponentBundle'
        );
    });

    it('closes on escape', async () => {
        const element = createCombobox();

        pressKey(button(element), 'ArrowDown');
        pressKey(button(element), 'Escape');
        await flushPromises();

        expect(combobox(element).classList.contains('slds-is-open')).toBe(
            false
        );
    });

    it('says when there is nothing to pick from', async () => {
        const element = createCombobox({
            options: [],
            emptyMessage: 'No org session'
        });

        click(button(element));
        await flushPromises();

        expect(
            element.shadowRoot.querySelector('.sfdl-combobox-empty').textContent
        ).toBe('No org session');
    });

    it('writes its label above it', () => {
        const element = createCombobox({ label: 'Metadata' });

        expect(
            element.shadowRoot.querySelector('.sfdl-combobox-label').textContent
        ).toBe('Metadata');
        expect(element.shadowRoot.querySelector('.sfdl-side-swatch')).toBeNull();
    });

    it('stands the colour of its side for the label, which shows on hover', () => {
        const element = createCombobox({ side: 'right', label: 'Right org' });
        const swatch = element.shadowRoot.querySelector('.sfdl-side-swatch');

        expect(swatch.classList.contains('sfdl-side-swatch_right')).toBe(true);
        expect(swatch.title).toBe('Right org');
        expect(swatch.parentElement.classList).toContain(
            'sfdl-combobox-control_right'
        );
        expect(element.shadowRoot.querySelector('.sfdl-combobox-label')).toBeNull();
        expect(button(element).getAttribute('aria-label')).toBe('Right org');
    });

    it('can be disabled', () => {
        const element = createCombobox({ disabled: true });

        expect(button(element).disabled).toBe(true);
    });
});
