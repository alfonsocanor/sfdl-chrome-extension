import { createElement } from 'lwc';
import Modal from 'sfdl/modal';

function createModal(properties = {}) {
    const element = createElement('sfdl-modal', { is: Modal });
    Object.assign(
        element,
        { title: 'Delete the logs?', message: 'They will be gone.' },
        properties
    );
    document.body.appendChild(element);
    return element;
}

const confirmButton = (element) =>
    element.shadowRoot.querySelector('.sfdl-modal__confirm');
const cancelButton = (element) =>
    element.shadowRoot.querySelector('.sfdl-modal__cancel');
const backdrop = (element) =>
    element.shadowRoot.querySelector('.slds-backdrop');

function click(node) {
    node.dispatchEvent(
        new CustomEvent('click', { bubbles: true, composed: true })
    );
}

function pressEscape(element) {
    const event = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        composed: true
    });
    element.shadowRoot.querySelector('.sfdl-modal').dispatchEvent(event);
}

describe('sfdl-modal', () => {
    it('shows the title, the message and the confirm label', () => {
        const element = createModal({ confirmLabel: 'Delete 2 logs' });

        expect(
            element.shadowRoot.querySelector('.slds-modal__title').textContent
        ).toBe('Delete the logs?');
        expect(
            element.shadowRoot.querySelector('.sfdl-modal__message').textContent
        ).toBe('They will be gone.');
        expect(confirmButton(element).textContent).toBe('Delete 2 logs');
    });

    it('asks with a cancel button only when given a cancel label', () => {
        expect(cancelButton(createModal())).toBeNull();
        expect(
            cancelButton(createModal({ cancelLabel: 'Keep them' })).textContent
        ).toBe('Keep them');
    });

    it('fires confirm from the confirm button', () => {
        const element = createModal({ cancelLabel: 'Cancel' });
        const confirm = jest.fn();
        element.addEventListener('confirm', confirm);

        click(confirmButton(element));

        expect(confirm).toHaveBeenCalledTimes(1);
    });

    it('fires cancel from the cancel button, the backdrop and Escape when it asks', () => {
        const element = createModal({ cancelLabel: 'Cancel' });
        const cancel = jest.fn();
        const confirm = jest.fn();
        element.addEventListener('cancel', cancel);
        element.addEventListener('confirm', confirm);

        click(cancelButton(element));
        click(backdrop(element));
        pressEscape(element);

        expect(cancel).toHaveBeenCalledTimes(3);
        expect(confirm).not.toHaveBeenCalled();
    });

    it('closes with confirm from the backdrop and Escape when it only tells', () => {
        const element = createModal();
        const confirm = jest.fn();
        element.addEventListener('confirm', confirm);

        click(backdrop(element));
        pressEscape(element);

        expect(confirm).toHaveBeenCalledTimes(2);
    });

    it('draws the confirm button of a destructive question in the destructive style', () => {
        expect(
            confirmButton(createModal({ variant: 'destructive' })).classList
        ).toContain('slds-button_destructive');
        expect(
            confirmButton(createModal({ variant: 'error' })).classList
        ).toContain('slds-button_brand');
    });

    it('puts the glyph of its variant on a disc', () => {
        const element = createModal({ variant: 'destructive' });
        const icon = element.shadowRoot.querySelector('.sfdl-modal__icon');

        expect(icon.classList).toContain('sfdl-modal__icon_warning');
        expect(icon.querySelector('img').getAttribute('src')).toBe(
            '/slds/icons/utility/warning.svg'
        );
    });

    it('focuses the confirm button when it opens', () => {
        const element = createModal();

        expect(element.shadowRoot.activeElement).toBe(confirmButton(element));
    });
});
