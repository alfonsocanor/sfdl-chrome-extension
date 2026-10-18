import { createElement } from 'lwc';
import LogManipulationMenu from 'sfdl/logManipulationMenu';

function createMenu(properties = {}) {
    const element = createElement('sfdl-log-manipulation-menu', {
        is: LogManipulationMenu
    });
    Object.assign(element, properties);
    document.body.appendChild(element);
    return element;
}

describe('sfdl-log-manipulation-menu', () => {
    it('starts with every manipulation option turned on', () => {
        const element = createMenu();

        expect(element.currentManipulationOptions()).toEqual([
            expect.objectContaining({
                name: 'methodEntryExitCodeUnitStartedFinished2Hierarchy',
                checked: true
            }),
            expect.objectContaining({
                name: 'removeHeapAllocateAndStatementExecute',
                checked: true
            }),
            expect.objectContaining({ name: 'removeFlowNoise', checked: true })
        ]);
    });

    it('starts from the options it is handed and leaves them untouched', () => {
        const options = [
            {
                label: 'Ignore timestamps',
                name: 'ignoreTimestamps',
                checked: false
            }
        ];
        const element = createMenu({ options });
        const handler = jest.fn();
        element.addEventListener('checkboxselection', handler);

        element.shadowRoot.querySelector('sfdl-checkbox').dispatchEvent(
            new CustomEvent('checkboxselection', {
                detail: { function2Execute: 'ignoreTimestamps', checked: true }
            })
        );

        expect(handler.mock.calls[0][0].detail.manipulationOptions).toEqual([
            {
                label: 'Ignore timestamps',
                name: 'ignoreTimestamps',
                checked: true
            }
        ]);
        expect(options[0].checked).toBe(false);
    });

    it('turns an option off and republishes the whole selection', () => {
        const element = createMenu();
        const handler = jest.fn();
        element.addEventListener('checkboxselection', handler);

        element.shadowRoot.querySelector('sfdl-checkbox').dispatchEvent(
            new CustomEvent('checkboxselection', {
                detail: { function2Execute: 'removeFlowNoise', checked: false }
            })
        );

        const { manipulationOptions } = handler.mock.calls[0][0].detail;
        expect(manipulationOptions).toContainEqual(
            expect.objectContaining({ name: 'removeFlowNoise', checked: false })
        );
        expect(element.currentManipulationOptions()).toContainEqual(
            expect.objectContaining({ name: 'removeFlowNoise', checked: false })
        );
    });

    it('ignores a selection for an option it does not own', () => {
        const element = createMenu();

        element.shadowRoot.querySelector('sfdl-checkbox').dispatchEvent(
            new CustomEvent('checkboxselection', {
                detail: { function2Execute: 'notAnOption', checked: false }
            })
        );

        expect(
            element
                .currentManipulationOptions()
                .every((option) => option.checked)
        ).toBe(true);
    });

    it('opens and closes the dropdown', () => {
        const element = createMenu();
        const dropdown = element.shadowRoot.querySelector('.sfdlDropdownMenu');
        const toggle = element.shadowRoot.querySelector('button');

        toggle.dispatchEvent(
            new CustomEvent('click', { bubbles: true, composed: true })
        );
        expect(dropdown.classList.contains('slds-is-open')).toBe(true);

        toggle.dispatchEvent(
            new CustomEvent('click', { bubbles: true, composed: true })
        );
        expect(dropdown.classList.contains('slds-is-open')).toBe(false);
    });
});
