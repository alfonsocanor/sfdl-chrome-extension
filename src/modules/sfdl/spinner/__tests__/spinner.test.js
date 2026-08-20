import { createElement } from 'lwc';
import Spinner from 'sfdl/spinner';

describe('sfdl-spinner', () => {
    it('renders a spinner with a status role', () => {
        const element = createElement('sfdl-spinner', { is: Spinner });
        document.body.appendChild(element);

        expect(
            element.shadowRoot.querySelector('.slds-spinner')
        ).not.toBeNull();
        expect(
            element.shadowRoot.querySelector('[role="status"]')
        ).not.toBeNull();
    });
});
