import { createElement } from 'lwc';
import DeleteAllLogs from 'sfdl/deleteAllLogs';

const SESSION_INFORMATION = {
    instanceUrl: 'https://acme.my.salesforce.com',
    authToken: 'token'
};

function createDeleteAllLogs() {
    const element = createElement('sfdl-delete-all-logs', {
        is: DeleteAllLogs
    });
    element.sessionInformation = SESSION_INFORMATION;
    document.body.appendChild(element);
    return element;
}

const dropdown = (element) =>
    element.shadowRoot.querySelector('.sfdlDropdownMenu');
const confirmButton = (element) =>
    element.shadowRoot.querySelector('.slds-button_brand');

function click(node) {
    node.dispatchEvent(
        new CustomEvent('click', { bubbles: true, composed: true })
    );
}

function flushPromises() {
    return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('sfdl-delete-all-logs', () => {
    it('warns the user before deleting anything', () => {
        const element = createDeleteAllLogs();

        expect(element.shadowRoot.querySelector('h2').textContent).toBe(
            'All Apex Logs in the org selected will be deleted'
        );
    });

    it('opens and closes the confirmation dropdown', () => {
        const element = createDeleteAllLogs();
        const toggle = element.shadowRoot.querySelector('button');

        click(toggle);
        expect(dropdown(element).classList.contains('slds-is-open')).toBe(true);

        click(toggle);
        expect(dropdown(element).classList.contains('slds-is-open')).toBe(
            false
        );
    });

    it('sends the delete job to the org it was given', async () => {
        global.fetch = jest.fn(() => Promise.resolve({ status: 200 }));
        const element = createDeleteAllLogs();

        click(confirmButton(element));
        await flushPromises();

        expect(global.fetch.mock.calls[0][0]).toBe(
            'https://acme.my.salesforce.com/services/async/51.0/job'
        );
        expect(global.fetch.mock.calls[0][1].method).toBe('DELETE');
        expect(global.fetch.mock.calls[0][1].headers.Authorization).toBe(
            'Bearer token'
        );
    });

    it('survives an org that cannot be reached', async () => {
        global.fetch = jest.fn(() => Promise.reject(new Error('network down')));
        const element = createDeleteAllLogs();

        click(confirmButton(element));

        await expect(flushPromises()).resolves.toBeUndefined();
    });
});
