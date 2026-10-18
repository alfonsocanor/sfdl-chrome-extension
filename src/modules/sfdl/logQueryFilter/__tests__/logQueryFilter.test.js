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

    it('opens and closes the filter dropdown', async () => {
        const element = createLogQueryFilter();
        const toggle = element.shadowRoot.querySelector('button');

        click(toggle);
        await Promise.resolve();
        expect(dropdown(element).classList.contains('slds-is-open')).toBe(true);

        click(toggle);
        await Promise.resolve();
        expect(dropdown(element).classList.contains('slds-is-open')).toBe(
            false
        );
    });

    it('stays open while the user clicks inside it', async () => {
        const element = createLogQueryFilter();

        click(element.shadowRoot.querySelector('button'));
        await Promise.resolve();
        click(element.shadowRoot.querySelector('textarea'));
        await Promise.resolve();

        expect(dropdown(element).classList.contains('slds-is-open')).toBe(true);
    });

    it('closes on a click anywhere else', async () => {
        const element = createLogQueryFilter();
        const elsewhere = document.createElement('div');
        document.body.appendChild(elsewhere);

        click(element.shadowRoot.querySelector('button'));
        await Promise.resolve();
        click(elsewhere);
        await Promise.resolve();

        expect(dropdown(element).classList.contains('slds-is-open')).toBe(
            false
        );
    });

    it('closes on Escape', async () => {
        const element = createLogQueryFilter();

        click(element.shadowRoot.querySelector('button'));
        await Promise.resolve();
        document.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Escape' })
        );
        await Promise.resolve();

        expect(dropdown(element).classList.contains('slds-is-open')).toBe(
            false
        );
    });

    it('stops listening to the page once it is gone', () => {
        const element = createLogQueryFilter();
        const removeEventListener = jest.spyOn(document, 'removeEventListener');

        document.body.removeChild(element);

        expect(removeEventListener).toHaveBeenCalledWith(
            'click',
            expect.any(Function)
        );
        removeEventListener.mockRestore();
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
