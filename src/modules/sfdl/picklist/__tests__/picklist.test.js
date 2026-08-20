import { createElement } from 'lwc';
import Picklist from 'sfdl/picklist';
import { showToastEvent, getValueLocalStorage } from 'sfdl/utils';

jest.mock('sfdl/utils', () => ({
    showToastEvent: jest.fn(),
    getValueLocalStorage: jest.fn(() => Promise.resolve(false)),
    clearLocalStorage: jest.fn()
}));

const PICKLIST_VALUES = [
    { label: 'https://acme.my.salesforce.com', value: 'sid-acme' },
    { label: 'https://globex.my.salesforce.com', value: 'sid-globex' }
];

function flushPromises() {
    return new Promise((resolve) => setTimeout(resolve, 0));
}

function createPicklist() {
    const element = createElement('sfdl-picklist', { is: Picklist });
    document.body.appendChild(element);
    return element;
}

const combobox = (element) =>
    element.shadowRoot.querySelector('.slds-combobox');
const options = (element) =>
    element.shadowRoot.querySelectorAll('.slds-listbox__option');
const selectedValue = (element) =>
    element.shadowRoot.querySelector('.slds-combobox__input .slds-truncate')
        .textContent;

function click(node) {
    node.dispatchEvent(
        new CustomEvent('click', { bubbles: true, composed: true })
    );
}

describe('sfdl-picklist', () => {
    beforeEach(() => {
        getValueLocalStorage.mockResolvedValue(false);
    });

    it('starts with the default placeholder and no options', () => {
        const element = createPicklist();

        expect(selectedValue(element)).toBe('Pick up an org...');
        expect(options(element).length).toBe(0);
    });

    it('shows the placeholder it is given', () => {
        const element = createElement('sfdl-picklist', { is: Picklist });
        element.placeholder = 'Select your domain';
        document.body.appendChild(element);

        expect(selectedValue(element)).toBe('Select your domain');
    });

    it('renders the org sessions it is given', async () => {
        const element = createPicklist();

        element.setPicklistValues(PICKLIST_VALUES);
        await flushPromises();

        expect(
            [...options(element)].map((option) => option.textContent.trim())
        ).toEqual([
            'https://acme.my.salesforce.com',
            'https://globex.my.salesforce.com'
        ]);
    });

    it('warns the user when there is no active org session', async () => {
        const element = createPicklist();
        element.setPicklistValues([]);
        await flushPromises();

        click(combobox(element));
        await flushPromises();

        expect(showToastEvent).toHaveBeenCalledWith(
            'warning',
            'No active org session :(',
            expect.any(String)
        );
        expect(combobox(element).classList.contains('slds-is-open')).toBe(
            false
        );
    });

    it('refuses to open while another sfdl console is downloading', async () => {
        getValueLocalStorage.mockResolvedValue(true);
        const element = createPicklist();
        element.setPicklistValues(PICKLIST_VALUES);
        await flushPromises();

        click(combobox(element));
        await flushPromises();

        expect(showToastEvent).toHaveBeenCalledWith(
            'warning',
            'Download already in progress',
            expect.any(String)
        );
        expect(combobox(element).classList.contains('slds-is-open')).toBe(
            false
        );
    });

    it('opens and closes the org list', async () => {
        const element = createPicklist();
        element.setPicklistValues(PICKLIST_VALUES);
        await flushPromises();

        click(combobox(element));
        await flushPromises();
        expect(combobox(element).classList.contains('slds-is-open')).toBe(true);

        click(combobox(element));
        await flushPromises();
        expect(combobox(element).classList.contains('slds-is-open')).toBe(
            false
        );
    });

    it('publishes the session information of the selected org', async () => {
        const element = createPicklist();
        const handler = jest.fn();
        element.addEventListener('sessioninformation', handler);
        element.setPicklistValues(PICKLIST_VALUES);
        await flushPromises();
        click(combobox(element));
        await flushPromises();

        click(options(element)[1]);
        await flushPromises();

        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler.mock.calls[0][0].detail.sessionInformation).toEqual({
            authToken: 'sid-globex',
            instanceUrl: 'https://globex.my.salesforce.com',
            queryWhere: ''
        });
        expect(selectedValue(element)).toBe('https://globex.my.salesforce.com');
    });

    it('carries the query filter into the session information', async () => {
        const element = createPicklist();
        const handler = jest.fn();
        element.addEventListener('sessioninformation', handler);
        element.setPicklistValues(PICKLIST_VALUES);
        await flushPromises();

        element.shadowRoot.querySelector('sfdl-log-query-filter').dispatchEvent(
            new CustomEvent('querywhere', {
                detail: { queryWhere: "WHERE Status = 'Success'" }
            })
        );
        click(combobox(element));
        await flushPromises();
        click(options(element)[0]);
        await flushPromises();

        expect(
            handler.mock.calls[0][0].detail.sessionInformation.queryWhere
        ).toBe("WHERE Status = 'Success'");
    });

    it('enables and disables the action buttons on demand', async () => {
        const element = createPicklist();
        await flushPromises();

        element.disableActionButtons(false);
        expect(
            element.shadowRoot.querySelector('.actionButtons').disabled
        ).toBe(false);

        element.disableActionButtons(true);
        expect(
            element.shadowRoot.querySelector('.actionButtons').disabled
        ).toBe(true);
    });
});
