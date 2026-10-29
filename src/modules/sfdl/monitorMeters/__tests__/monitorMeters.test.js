import { createElement } from 'lwc';
import MonitorMeters from 'sfdl/monitorMeters';

const MONITOR = {
    key: 'orgLimits',
    title: 'Every limit the org reports',
    description: 'How far the org is into each limit.',
    emptyMessage: 'The org reports no limit.'
};

const ITEMS = [
    { id: 'DailyApiRequests', name: 'DailyApiRequests', label: 'API requests today', aliases: ['rest', 'calls'], used: 13500, max: 15000, percent: 90, isUnused: false },
    { id: 'PermissionSets', name: 'PermissionSets', label: 'Permission sets', aliases: ['perms'], used: 300, max: 1500, percent: 20, isUnused: false },
    { id: 'MassEmail', name: 'MassEmail', label: 'Mass emails today', aliases: ['mail'], used: 0, max: 10, percent: 0, isUnused: true }
];

function createMeters(state) {
    const element = createElement('sfdl-monitor-meters', { is: MonitorMeters });
    element.monitor = MONITOR;
    element.state = state;
    document.body.appendChild(element);
    return element;
}

const loaded = (items = ITEMS) => ({
    status: 'loaded',
    items,
    summary: { value: '90%', caption: 'API requests today, 13500 of 15000', severity: 'alert', severityLabel: 'Needs a look' }
});
const texts = (element, selector) =>
    [...element.shadowRoot.querySelectorAll(selector)].map((node) => node.textContent.trim());
const unusedToggle = (element) => element.shadowRoot.querySelector('.sfdl-monitor-meters__unused-toggle');
const searchInput = (element) => element.shadowRoot.querySelector('.sfdl-monitor-meters__search-input');

function type(element, value) {
    searchInput(element).value = value;
    searchInput(element).dispatchEvent(new CustomEvent('input', { bubbles: true, composed: true }));
}

function click(node) {
    node.dispatchEvent(new CustomEvent('click', { bubbles: true, composed: true }));
}

describe('sfdl-monitor-meters', () => {
    it('stands a stencil of meters in while it loads, under what it is about', () => {
        const element = createMeters({ status: 'loading' });

        expect(texts(element, '.sfdl-monitor-meters__summary')).toEqual(['How far the org is into each limit.']);
        expect(element.shadowRoot.querySelector('sfdl-loading-stencil').type).toBe('monitorMeters');
        expect(element.shadowRoot.querySelector('.sfdl-monitor-meters').getAttribute('aria-busy')).toBe('true');
    });

    it('draws a meter per item in use with its words, its figure and its bar, red past the alert line', () => {
        const element = createMeters(loaded());

        expect(texts(element, '.sfdl-monitor-meters__name')).toEqual(['API requests today', 'Permission sets']);
        expect(texts(element, '.sfdl-monitor-meters__figure')).toEqual(['13500 of 15000, 90%', '300 of 1500, 20%']);
        const fills = element.shadowRoot.querySelectorAll('.sfdl-monitor-meters__fill');
        expect(fills[0].getAttribute('style')).toBe('width:90%;');
        expect(fills[0].classList).toContain('sfdl-monitor-meters__fill_alert');
        expect(fills[1].classList).not.toContain('sfdl-monitor-meters__fill_alert');
        expect(
            element.shadowRoot.querySelector('.sfdl-monitor-meters__meter').getAttribute('title')
        ).toBe('API requests today: 13500 of 15000 (DailyApiRequests)');
    });

    it('sums up in its header with the words of the severity', () => {
        const element = createMeters(loaded());

        expect(texts(element, '.sfdl-monitor-meters__summary')).toEqual([
            '2 of 3 limits in use, the most used API requests today, 13500 of 15000'
        ]);
        expect(texts(element, '.sfdl-monitor-meters__severity')).toEqual(['Needs a look']);
        expect(element.shadowRoot.querySelector('.sfdl-monitor-meters__severity').classList).toContain(
            'sfdl-monitor-meters__severity_alert'
        );
    });

    it('keeps the limits not used behind a toggle that shows and hides them', async () => {
        const element = createMeters(loaded());

        expect(unusedToggle(element).textContent).toBe('Show the 1 limit not used');

        click(unusedToggle(element));
        await Promise.resolve();

        expect(texts(element, '.sfdl-monitor-meters__name')).toEqual(['API requests today', 'Permission sets', 'Mass emails today']);
        expect(unusedToggle(element).textContent).toBe('Hide the 1 limit not used');

        click(unusedToggle(element));
        await Promise.resolve();

        expect(texts(element, '.sfdl-monitor-meters__name')).toEqual(['API requests today', 'Permission sets']);
    });

    it('keeps the limits not used after the ones in use whatever order they come in', async () => {
        const element = createMeters(loaded([ITEMS[2], ITEMS[0], ITEMS[1]]));

        click(unusedToggle(element));
        await Promise.resolve();

        expect(texts(element, '.sfdl-monitor-meters__name')).toEqual(['API requests today', 'Permission sets', 'Mass emails today']);
    });

    it('offers no toggle when every limit is in use, and says so when none is', () => {
        expect(unusedToggle(createMeters(loaded(ITEMS.slice(0, 2))))).toBeNull();

        const element = createMeters(loaded([ITEMS[2]]));
        expect(texts(element, '.sfdl-monitor-meters__empty')).toEqual(['The org reports no limit.']);
        expect(unusedToggle(element).textContent).toBe('Show the 1 limit not used');
    });

    it('says why it failed, and what the monitor says with nothing to draw', () => {
        expect(texts(createMeters({ status: 'failed', error: 'Invalid session' }), '.sfdl-monitor-meters__error')).toEqual(['Invalid session']);
        expect(texts(createMeters(loaded([])), '.sfdl-monitor-meters__empty')).toEqual(['The org reports no limit.']);
    });

    it('filters the meters by their words, their API name or their aliases, mistyped or not', async () => {
        const element = createMeters(loaded());

        type(element, 'permision');
        await Promise.resolve();
        expect(texts(element, '.sfdl-monitor-meters__name')).toEqual(['Permission sets']);

        type(element, 'rest');
        await Promise.resolve();
        expect(texts(element, '.sfdl-monitor-meters__name')).toEqual(['API requests today']);

        type(element, 'dailyapi');
        await Promise.resolve();
        expect(texts(element, '.sfdl-monitor-meters__name')).toEqual(['API requests today']);
    });

    it('searches the limits not used too while filtering, and keeps the toggle away', async () => {
        const element = createMeters(loaded());

        type(element, 'mial');
        await Promise.resolve();

        expect(texts(element, '.sfdl-monitor-meters__name')).toEqual(['Mass emails today']);
        expect(unusedToggle(element)).toBeNull();
    });

    it('says when nothing goes by what was typed, and clears from the X and from Escape', async () => {
        const element = createMeters(loaded());

        type(element, 'zzzz');
        await Promise.resolve();
        expect(texts(element, '.sfdl-monitor-meters__empty')).toEqual(['No limit goes by "zzzz"']);

        click(element.shadowRoot.querySelector('.sfdl-monitor-meters__search-clear'));
        await Promise.resolve();
        expect(texts(element, '.sfdl-monitor-meters__name')).toEqual(['API requests today', 'Permission sets']);
        expect(searchInput(element).value).toBe('');

        type(element, 'perms');
        await Promise.resolve();
        searchInput(element).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }));
        await Promise.resolve();
        expect(texts(element, '.sfdl-monitor-meters__name')).toEqual(['API requests today', 'Permission sets']);
    });

    it('offers no filter before the limits are in', () => {
        expect(searchInput(createMeters({ status: 'loading' }))).toBeNull();
        expect(searchInput(createMeters(loaded([])))).toBeNull();
    });
});

