import { createElement } from 'lwc';
import Toast from 'sfdl/toast';
import { adoptStyleSheet } from 'sfdl/styleSheets';

function createToast(action = 'success') {
    const element = createElement('sfdl-toast', { is: Toast });
    element.action = action;
    element.header = 'sfdl';
    element.message = 'Logs downloaded';
    document.body.appendChild(element);
    return element;
}

const notification = (element) =>
    element.shadowRoot.querySelector('.slds-notify_toast');
const container = (element) =>
    element.shadowRoot.querySelector('.slds-notify_container');

describe('sfdl-toast', () => {
    it('renders the header and the message', () => {
        const element = createToast();

        expect(element.shadowRoot.querySelector('h2').textContent).toBe('sfdl');
        expect(element.shadowRoot.querySelector('p').textContent).toBe(
            'Logs downloaded'
        );
    });

    it.each([
        ['success', 'slds-theme_success', '/slds/icons/utility/success.svg'],
        ['error', 'slds-theme_error', '/slds/icons/utility/error.svg'],
        ['warning', 'slds-theme_warning', '/slds/icons/utility/warning.svg'],
        ['info', 'slds-theme_info', '/slds/icons/utility/info.svg']
    ])('themes the %s toast', (action, htmlClass, icon) => {
        const element = createToast(action);

        expect(notification(element).classList.contains(htmlClass)).toBe(true);
        return Promise.resolve().then(() => {
            expect(
                element.shadowRoot.querySelector('.slds-icon_container img').src
            ).toContain(icon);
        });
    });

    it('keeps the stylesheets the other components adopted', () => {
        const consoleSheet = adoptStyleSheet('.sfdl-console {}');

        createToast();

        expect(document.adoptedStyleSheets).toContain(consoleSheet);
        expect(document.adoptedStyleSheets).toHaveLength(2);
    });

    it('animates in shortly after being rendered', () => {
        jest.useFakeTimers();
        try {
            const element = createToast();
            expect(container(element).classList.contains('animation-in')).toBe(
                false
            );

            jest.advanceTimersByTime(50);

            expect(container(element).classList.contains('animation-in')).toBe(
                true
            );
        } finally {
            jest.useRealTimers();
        }
    });

    it('animates out when the caller finalizes it', () => {
        jest.useFakeTimers();
        try {
            const element = createToast();
            jest.advanceTimersByTime(50);

            element.finalizeAnimation();

            expect(container(element).classList.contains('animation-in')).toBe(
                false
            );
            expect(container(element).classList.contains('animation-out')).toBe(
                true
            );
        } finally {
            jest.useRealTimers();
        }
    });
});
