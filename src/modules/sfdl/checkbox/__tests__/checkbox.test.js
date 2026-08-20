import { createElement } from 'lwc';
import Checkbox from 'sfdl/checkbox';

const OPTIONS = [
    {
        label: 'ENTRY/EXIT',
        name: 'methodEntryExitCodeUnitStartedFinished2Hierarchy',
        checked: true
    },
    {
        label: 'HEAP_ALLOCATE',
        name: 'removeHeapAllocateAndStatementExecute',
        checked: false
    }
];

function createCheckbox(checkboxOptions = OPTIONS) {
    const element = createElement('sfdl-checkbox', { is: Checkbox });
    element.checkboxOptions = checkboxOptions;
    document.body.appendChild(element);
    return element;
}

describe('sfdl-checkbox', () => {
    it('renders one input per option with its label and checked state', () => {
        const element = createCheckbox();

        const inputs = element.shadowRoot.querySelectorAll(
            'input[type="checkbox"]'
        );
        expect(inputs.length).toBe(2);
        expect(inputs[0].name).toBe(OPTIONS[0].name);
        expect(inputs[0].checked).toBe(true);
        expect(inputs[1].checked).toBe(false);
        expect(
            [
                ...element.shadowRoot.querySelectorAll(
                    '.slds-form-element__label'
                )
            ].map((label) => label.textContent)
        ).toEqual(['ENTRY/EXIT', 'HEAP_ALLOCATE']);
    });

    it('reports the option name and its new state on selection', () => {
        const element = createCheckbox();
        const handler = jest.fn();
        element.addEventListener('checkboxselection', handler);

        const input = element.shadowRoot.querySelectorAll(
            'input[type="checkbox"]'
        )[1];
        input.checked = true;
        input.dispatchEvent(
            new CustomEvent('change', { bubbles: true, composed: true })
        );

        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler.mock.calls[0][0].detail).toEqual({
            function2Execute: 'removeHeapAllocateAndStatementExecute',
            checked: true
        });
    });

    it('renders nothing when there are no options', () => {
        const element = createCheckbox([]);

        expect(
            element.shadowRoot.querySelectorAll('input[type="checkbox"]').length
        ).toBe(0);
    });
});
