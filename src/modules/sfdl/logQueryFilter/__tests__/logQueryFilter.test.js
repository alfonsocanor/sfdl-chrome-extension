import { createElement } from 'lwc';
import LogQueryFilter from 'sfdl/logQueryFilter';

function createLogQueryFilter() {
    const element = createElement('sfdl-log-query-filter', {
        is: LogQueryFilter
    });
    document.body.appendChild(element);
    return element;
}

const dropdown = (element) =>
    element.shadowRoot.querySelector('.sfdlDropdownMenu');

function click(node) {
    node.dispatchEvent(
        new CustomEvent('click', { bubbles: true, composed: true })
    );
}

describe('sfdl-log-query-filter', () => {
    it('suggests a query example as the placeholder', () => {
        const element = createLogQueryFilter();

        expect(
            element.shadowRoot.querySelector('textarea').placeholder
        ).toContain('WHERE LogUser.Name');
    });

    it('opens and closes the filter dropdown', () => {
        const element = createLogQueryFilter();
        const toggle = element.shadowRoot.querySelector('button');

        click(toggle);
        expect(dropdown(element).classList.contains('slds-is-open')).toBe(true);

        click(toggle);
        expect(dropdown(element).classList.contains('slds-is-open')).toBe(
            false
        );
    });

    it('publishes the where clause typed by the user', () => {
        const element = createLogQueryFilter();
        const handler = jest.fn();
        element.addEventListener('querywhere', handler);

        const textarea = element.shadowRoot.querySelector('textarea');
        textarea.value = "WHERE Status = 'Success' LIMIT 5";
        textarea.dispatchEvent(
            new CustomEvent('change', { bubbles: true, composed: true })
        );

        expect(handler.mock.calls[0][0].detail).toEqual({
            queryWhere: "WHERE Status = 'Success' LIMIT 5"
        });
    });
});
