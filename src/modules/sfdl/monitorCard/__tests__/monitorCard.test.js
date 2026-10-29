import { createElement } from 'lwc';
import MonitorCard from 'sfdl/monitorCard';

const MONITOR = {
    key: 'failedJobs',
    title: 'Failed async jobs',
    description: 'Jobs that failed.'
};

function createCard(state) {
    const element = createElement('sfdl-monitor-card', { is: MonitorCard });
    element.monitor = MONITOR;
    element.state = state;
    document.body.appendChild(element);
    return element;
}

const card = (element) => element.shadowRoot.querySelector('.sfdl-monitor-card');
const text = (element, selector) => {
    const node = element.shadowRoot.querySelector(selector);
    return node ? node.textContent.trim() : null;
};

function click(node) {
    node.dispatchEvent(
        new CustomEvent('click', { bubbles: true, composed: true })
    );
}

describe('sfdl-monitor-card', () => {
    it('stands a stencil in for its figure while it loads, and cannot be opened', () => {
        const element = createCard({ status: 'loading' });

        expect(text(element, '.sfdl-monitor-card__label')).toBe('Failed async jobs');
        expect(card(element).getAttribute('title')).toBe('Jobs that failed.');
        expect(card(element).getAttribute('aria-disabled')).toBe('true');
        expect(card(element).getAttribute('aria-busy')).toBe('true');
        expect(
            element.shadowRoot.querySelector('sfdl-loading-stencil').type
        ).toBe('monitorCard');
    });

    it('shows the figure, its caption and the words of its severity once loaded', () => {
        const element = createCard({
            status: 'loaded',
            summary: {
                value: 3,
                caption: 'of 57 async jobs in the last 7 days',
                severity: 'alert',
                severityLabel: 'Needs a look'
            }
        });

        expect(text(element, '.sfdl-monitor-card__value')).toBe('3');
        expect(text(element, '.sfdl-monitor-card__caption')).toBe(
            'of 57 async jobs in the last 7 days'
        );
        expect(text(element, '.sfdl-monitor-card__severity')).toBe('Needs a look');
        expect(
            element.shadowRoot.querySelector('.sfdl-monitor-card__severity').classList
        ).toContain('sfdl-monitor-card__severity_alert');
        expect(card(element).classList).toContain('sfdl-monitor-card_alert');
        expect(card(element).getAttribute('aria-disabled')).toBe('false');
        expect(card(element).getAttribute('tabindex')).toBe('0');
        expect(card(element).getAttribute('role')).toBe('button');
        expect(element.shadowRoot.querySelector('sfdl-loading-stencil')).toBeNull();
    });

    it('opens with the key of its monitor when clicked loaded', () => {
        const element = createCard({
            status: 'loaded',
            summary: { value: 0, caption: '', severity: 'clear', severityLabel: 'All clear' }
        });
        const open = jest.fn();
        element.addEventListener('open', open);

        click(card(element));

        expect(open.mock.calls[0][0].detail).toEqual({ key: 'failedJobs' });
    });

    it('wears the blue of an overview for a figure that is there to be known', () => {
        const element = createCard({
            status: 'loaded',
            summary: { value: 12, caption: 'of 40 flows', severity: 'info', severityLabel: 'Overview' }
        });

        expect(text(element, '.sfdl-monitor-card__severity')).toBe('Overview');
        expect(
            element.shadowRoot.querySelector('.sfdl-monitor-card__severity').classList
        ).toContain('sfdl-monitor-card__severity_info');
    });

    it('shows why it failed and does not open', () => {
        const element = createCard({ status: 'failed', error: 'Invalid session' });
        const open = jest.fn();
        element.addEventListener('open', open);

        click(card(element));

        expect(text(element, '.sfdl-monitor-card__error')).toBe('Invalid session');
        expect(card(element).getAttribute('aria-disabled')).toBe('true');
        expect(open).not.toHaveBeenCalled();
    });

    it('tells what the org needs, in grey, when it does not have the monitor, and does not open', () => {
        const element = createCard({ status: 'unavailable', error: 'Comes with Shield.' });
        const open = jest.fn();
        element.addEventListener('open', open);

        click(card(element));

        expect(text(element, '.sfdl-monitor-card__requires')).toBe('Comes with Shield.');
        expect(text(element, '.sfdl-monitor-card__severity')).toBe('Not in this org');
        expect(
            element.shadowRoot.querySelector('.sfdl-monitor-card__severity').classList
        ).toContain('sfdl-monitor-card__severity_unavailable');
        expect(card(element).classList).toContain('sfdl-monitor-card_unavailable');
        expect(element.shadowRoot.querySelector('.sfdl-monitor-card__error')).toBeNull();
        expect(card(element).getAttribute('aria-disabled')).toBe('true');
        expect(open).not.toHaveBeenCalled();
    });

    it('opens with Enter or the space bar, and not when the click ends a selection of its words', () => {
        const element = createCard({
            status: 'loaded',
            summary: { value: 3, caption: 'of 9', severity: 'alert', severityLabel: 'Needs a look' }
        });
        const open = jest.fn();
        element.addEventListener('open', open);

        card(element).dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
        card(element).dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
        card(element).dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
        expect(open).toHaveBeenCalledTimes(2);

        const range = document.createRange();
        range.selectNodeContents(element.shadowRoot.querySelector('.sfdl-monitor-card__caption'));
        window.getSelection().addRange(range);
        click(card(element));
        expect(open).toHaveBeenCalledTimes(2);

        window.getSelection().removeAllRanges();
        click(card(element));
        expect(open).toHaveBeenCalledTimes(3);
    });
});
