import { createElement } from 'lwc';
import Spinner from 'sfdl/spinner';

function createSpinner(properties = {}) {
    const element = createElement('sfdl-spinner', { is: Spinner });
    Object.assign(element, properties);
    document.body.appendChild(element);
    return element;
}

describe('sfdl-spinner', () => {
    it('renders a spinner with a status role', () => {
        const element = createSpinner();

        expect(
            element.shadowRoot.querySelector('.slds-spinner')
        ).not.toBeNull();
        expect(
            element.shadowRoot.querySelector('[role="status"]')
        ).not.toBeNull();
    });

    it('spins in the brand colour', () => {
        const element = createSpinner();

        expect(
            element.shadowRoot.querySelector('.slds-spinner').classList
        ).toContain('slds-spinner_brand');
    });

    it('writes what it waits for under itself', () => {
        const element = createSpinner({ message: 'Retrieving Utils...' });
        const message = element.shadowRoot.querySelector(
            '.sfdl-spinner__message'
        );

        expect(message.textContent).toBe('Retrieving Utils...');
        expect(message.previousElementSibling.classList).toContain(
            'slds-spinner'
        );
    });

    it('writes nothing without a message', () => {
        const element = createSpinner();

        expect(
            element.shadowRoot.querySelector('.sfdl-spinner__message')
        ).toBeNull();
    });
});
