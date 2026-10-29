import { createElement } from 'lwc';
import MonitorDetail from 'sfdl/monitorDetail';
import { formatDay, dayOf } from 'sfdl/monitors';
import { saveAs } from 'file-saver';

jest.mock('file-saver', () => ({ saveAs: jest.fn() }));

const MONITOR = {
    key: 'jobs',
    title: 'Failed async jobs',
    description: 'Jobs that failed.',
    emptyMessage: 'No job failed.',
    columns: [
        { key: 'when', label: 'When', kind: 'date' },
        { key: 'apexClass', label: 'Class' },
        { key: 'errors', label: 'Errors', kind: 'number' },
        { key: 'percent', label: 'Usage', kind: 'meter' }
    ],
    groupings: [
        { key: 'day', label: 'By day', by: (item) => dayOf(item.when), format: formatDay, sort: 'key' },
        { key: 'class', label: 'By class', by: (item) => item.apexClass }
    ]
};

const WHEN_A = new Date(2026, 9, 7, 9, 5).toISOString();
const WHEN_B = new Date(2026, 9, 9, 18, 30).toISOString();
const ITEMS = [
    { id: '1', when: WHEN_A, apexClass: 'Nightly', errors: 2, percent: 90, isStuck: true },
    { id: '2', when: WHEN_B, apexClass: 'Sync', errors: 0, percent: 10 },
    { id: '3', when: WHEN_B, apexClass: 'Nightly', errors: 1, percent: 50 }
];

function createDetail(items = ITEMS) {
    const element = createElement('sfdl-monitor-detail', { is: MonitorDetail });
    element.monitor = MONITOR;
    element.items = items;
    element.summary = { value: items.length, caption: 'of 10 jobs' };
    document.body.appendChild(element);
    return element;
}

//Reads inside the component, or inside one of its nodes.
const texts = (root, selector) =>
    [...(root.shadowRoot || root).querySelectorAll(selector)].map((node) => node.textContent.trim());
const groupingButtons = (element) =>
    element.shadowRoot.querySelectorAll('.sfdl-monitor-detail__grouping');

function click(node) {
    node.dispatchEvent(
        new CustomEvent('click', { bubbles: true, composed: true })
    );
}

describe('sfdl-monitor-detail', () => {
    it('heads with the title of the monitor and the figure of the card', () => {
        const element = createDetail();

        expect(texts(element, '.sfdl-monitor-detail__title')).toEqual(['Failed async jobs']);
        expect(texts(element, '.sfdl-monitor-detail__summary')).toEqual(['3 of 10 jobs']);
        expect(texts(element, '.sfdl-monitor-detail__description')).toEqual(['Jobs that failed.']);
    });

    it('goes back with its button', () => {
        const element = createDetail();
        const back = jest.fn();
        element.addEventListener('back', back);

        click(element.shadowRoot.querySelector('.sfdl-monitor-detail__back'));

        expect(back).toHaveBeenCalledTimes(1);
    });

    it('offers every breakdown, the first one pressed, and draws its bars', () => {
        const element = createDetail();

        expect(texts(element, '.sfdl-monitor-detail__grouping')).toEqual(['By day', 'By class']);
        expect(groupingButtons(element)[0].getAttribute('aria-pressed')).toBe('true');
        expect(groupingButtons(element)[0].classList).toContain('slds-button_brand');
        expect(texts(element, '.sfdl-monitor-detail__bar-label')).toEqual(['07/10', '09/10']);
        expect(texts(element, '.sfdl-monitor-detail__bar-count')).toEqual(['1', '2']);
        const bars = element.shadowRoot.querySelectorAll('.sfdl-monitor-detail__bar');
        expect(bars[0].getAttribute('style')).toBe('width:50%;');
        expect(bars[1].getAttribute('style')).toBe('width:100%;');
        expect(
            element.shadowRoot.querySelector('.sfdl-monitor-detail__bar-row').getAttribute('title')
        ).toBe('07/10: 1');
    });

    it('draws a breakdown of kind day as columns over the run of days, the empty ones in', async () => {
        const dayAgo = (days) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
        const element = createElement('sfdl-monitor-detail', { is: MonitorDetail });
        element.monitor = {
            ...MONITOR,
            groupings: [{ key: 'day', label: 'By day', kind: 'day', by: (item) => dayOf(item.when), format: formatDay, sort: 'key' }]
        };
        element.items = [
            { id: '1', when: dayAgo(3), apexClass: 'A', errors: 0, percent: 0 },
            { id: '2', when: dayAgo(3), apexClass: 'A', errors: 0, percent: 0 },
            { id: '3', when: dayAgo(1), apexClass: 'A', errors: 0, percent: 0 }
        ];
        document.body.appendChild(element);
        await Promise.resolve();

        expect(element.shadowRoot.querySelector('.sfdl-monitor-detail__bars')).toBeNull();
        const days = element.shadowRoot.querySelectorAll('.sfdl-monitor-detail__day');
        expect(days.length).toBe(4);
        expect(texts(element, '.sfdl-monitor-detail__column-count')).toEqual(['2', '', '1', '']);
        expect(texts(element, '.sfdl-monitor-detail__column-label')).toEqual([
            formatDay(dayOf(dayAgo(3))), formatDay(dayOf(dayAgo(2))), formatDay(dayOf(dayAgo(1))), formatDay(dayOf(dayAgo(0)))
        ]);
        const columns = element.shadowRoot.querySelectorAll('.sfdl-monitor-detail__column');
        expect(columns[0].getAttribute('style')).toBe('height:100%;');
        expect(columns[1].getAttribute('style')).toBe('height:0%;');
        expect(days[1].classList).toContain('sfdl-monitor-detail__day_empty');
        expect(days[0].getAttribute('title')).toBe(formatDay(dayOf(dayAgo(3))) + ': 2');
    });

    it('counts by another breakdown when its button is pressed', async () => {
        const element = createDetail();

        click(groupingButtons(element)[1]);
        await Promise.resolve();

        expect(groupingButtons(element)[1].getAttribute('aria-pressed')).toBe('true');
        expect(groupingButtons(element)[0].getAttribute('aria-pressed')).toBe('false');
        expect(texts(element, '.sfdl-monitor-detail__bar-label')).toEqual(['Nightly', 'Sync']);
        expect(texts(element, '.sfdl-monitor-detail__bar-count')).toEqual(['2', '1']);
    });

    it('lists the items column for column as the monitor describes them', () => {
        const element = createDetail();

        expect(texts(element, 'th')).toEqual(['When', 'Class', 'Errors', 'Usage']);
        const rows = element.shadowRoot.querySelectorAll('tbody tr');
        expect(rows.length).toBe(3);
        expect(texts(rows[0], 'td')).toEqual(['07/10 09:05', 'Nightly', '2', '90%']);
        expect(rows[0].classList).toContain('sfdl-monitor-detail__row_alert');
        expect(rows[1].classList).not.toContain('sfdl-monitor-detail__row_alert');
        expect(rows[0].querySelectorAll('td')[2].classList).toContain('sfdl-monitor-detail__cell_number');
    });

    it('draws a meter cell as a bar, red once over the alert line', () => {
        const element = createDetail();
        const fills = element.shadowRoot.querySelectorAll('.sfdl-monitor-detail__meter-fill');

        expect(fills.length).toBe(3);
        expect(fills[0].getAttribute('style')).toBe('width:90%;');
        expect(fills[0].classList).toContain('sfdl-monitor-detail__meter-fill_alert');
        expect(fills[1].getAttribute('style')).toBe('width:10%;');
        expect(fills[1].classList).not.toContain('sfdl-monitor-detail__meter-fill_alert');
    });

    it('cuts a long message short with a more at its foot that shows the whole of it', async () => {
        const message = 'System.LimitException: Too many SOQL queries: 101, raised from the trigger on Account after the batch ran';
        const element = createDetail([
            { id: '1', when: WHEN_A, apexClass: message, errors: 0, percent: 0 },
            { id: '2', when: WHEN_B, apexClass: 'Short', errors: 0, percent: 0 }
        ]);
        const more = (row) => row.querySelector('.sfdl-monitor-detail__more');
        const rows = () => element.shadowRoot.querySelectorAll('tbody tr');
        const longCell = () => rows()[0].querySelectorAll('td')[1];

        expect(more(rows()[0]).textContent).toBe('more');
        expect(more(rows()[1])).toBeNull();
        expect(longCell().classList).not.toContain('sfdl-monitor-detail__cell_expanded');
        expect(longCell().querySelector('.sfdl-monitor-detail__cell-text').textContent).toBe(message);

        click(more(rows()[0]));
        await Promise.resolve();

        expect(longCell().classList).toContain('sfdl-monitor-detail__cell_expanded');
        expect(more(rows()[0]).textContent).toBe('less');

        click(more(rows()[0]));
        await Promise.resolve();

        expect(longCell().classList).not.toContain('sfdl-monitor-detail__cell_expanded');
        expect(more(rows()[0]).textContent).toBe('more');
    });

    it('folds every cell again when it is given other items', async () => {
        const message = 'A'.repeat(80);
        const element = createDetail([{ id: '1', when: WHEN_A, apexClass: message, errors: 0, percent: 0 }]);
        click(element.shadowRoot.querySelector('.sfdl-monitor-detail__more'));
        await Promise.resolve();

        element.items = [{ id: '1', when: WHEN_A, apexClass: message, errors: 1, percent: 0 }];
        await Promise.resolve();

        expect(
            element.shadowRoot.querySelectorAll('td')[1].classList
        ).not.toContain('sfdl-monitor-detail__cell_expanded');
    });

    it('says what the monitor says with nothing to list, and offers no breakdown', () => {
        const element = createDetail([]);

        expect(texts(element, '.sfdl-monitor-detail__empty')).toEqual(['No job failed.']);
        expect(element.shadowRoot.querySelector('table')).toBeNull();
        expect(groupingButtons(element).length).toBe(0);
    });

    describe('narrowing the rows', () => {
        const rowTexts = (element) =>
            [...element.shadowRoot.querySelectorAll('tbody tr')].map((row) => texts(row, 'td')[1]);
        const barButtons = (element) => element.shadowRoot.querySelectorAll('.sfdl-monitor-detail__bar-row');
        const search = (element) => element.shadowRoot.querySelector('.sfdl-monitor-detail__search-input');
        const rowCount = (element) => texts(element, '.sfdl-monitor-detail__row-count')[0];

        function type(element, value) {
            search(element).value = value;
            search(element).dispatchEvent(new CustomEvent('input'));
        }

        it('lists the items of a bar clicked only, and every item again on a second click', async () => {
            const element = createDetail();
            click(groupingButtons(element)[1]);
            await Promise.resolve();

            click(barButtons(element)[1]);
            await Promise.resolve();

            expect(rowTexts(element)).toEqual(['Sync']);
            expect(barButtons(element)[1].getAttribute('aria-pressed')).toBe('true');
            expect(barButtons(element)[1].getAttribute('role')).toBe('button');
            expect(barButtons(element)[0].classList).toContain('sfdl-monitor-detail__group_dimmed');
            expect(texts(element, '.sfdl-monitor-detail__selection')).toEqual(['By class: Sync']);
            expect(rowCount(element)).toBe('1 of 3 rows');

            click(barButtons(element)[1]);
            await Promise.resolve();

            expect(rowTexts(element)).toEqual(['Nightly', 'Sync', 'Nightly']);
            expect(element.shadowRoot.querySelector('.sfdl-monitor-detail__selection')).toBeNull();
            expect(rowCount(element)).toBe('3 rows');
        });

        it('lets the bar picked go from its chip, and when another breakdown is picked', async () => {
            const element = createDetail();
            click(groupingButtons(element)[1]);
            await Promise.resolve();
            click(barButtons(element)[0]);
            await Promise.resolve();
            expect(rowTexts(element)).toEqual(['Nightly', 'Nightly']);

            click(element.shadowRoot.querySelector('.sfdl-monitor-detail__selection-clear'));
            await Promise.resolve();
            expect(rowTexts(element).length).toBe(3);

            click(barButtons(element)[0]);
            await Promise.resolve();
            click(groupingButtons(element)[0]);
            await Promise.resolve();
            expect(rowTexts(element).length).toBe(3);
        });

        it('lists the items folded into Other when its bar is clicked', async () => {
            const items = Array.from({ length: 12 }, (unused, index) => ({
                id: String(index), when: WHEN_A, apexClass: 'Class' + String(index).padStart(2, '0'), errors: 0, percent: 0
            }));
            items.push({ id: 'x', when: WHEN_A, apexClass: 'Class00', errors: 0, percent: 0 });
            const element = createDetail(items);
            click(groupingButtons(element)[1]);
            await Promise.resolve();

            const other = barButtons(element)[9];
            expect(other.dataset.key).toBe('other');
            click(other);
            await Promise.resolve();

            expect(rowTexts(element)).toEqual(['Class09', 'Class10', 'Class11']);
        });

        it('lists the items of a day clicked on the run of days, an empty day not clickable', async () => {
            const dayAgo = (days) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
            const element = createElement('sfdl-monitor-detail', { is: MonitorDetail });
            element.monitor = {
                ...MONITOR,
                groupings: [{ key: 'day', label: 'By day', kind: 'day', by: (item) => dayOf(item.when), format: formatDay, sort: 'key' }]
            };
            element.items = [
                { id: '1', when: dayAgo(2), apexClass: 'A', errors: 0, percent: 0 },
                { id: '2', when: dayAgo(0), apexClass: 'B', errors: 0, percent: 0 }
            ];
            document.body.appendChild(element);
            await Promise.resolve();
            const days = () => element.shadowRoot.querySelectorAll('.sfdl-monitor-detail__day');

            expect(days()[1].getAttribute('aria-disabled')).toBe('true');
            expect(days()[1].getAttribute('tabindex')).toBe('-1');
            click(days()[1]);
            await Promise.resolve();
            expect(rowTexts(element)).toEqual(['A', 'B']);

            click(days()[2]);
            await Promise.resolve();

            expect(rowTexts(element)).toEqual(['B']);
            expect(texts(element, '.sfdl-monitor-detail__selection')).toEqual(['By day: ' + formatDay(dayOf(dayAgo(0)))]);
        });

        it('keeps the rows with what is typed in any cell, as shown or as they are, and clears with escape', async () => {
            const element = createDetail();

            type(element, 'sync');
            await Promise.resolve();
            expect(rowTexts(element)).toEqual(['Sync']);
            expect(texts(element, '.sfdl-monitor-detail__bar-label')).toEqual(['09/10']);

            type(element, '07/10 09');
            await Promise.resolve();
            expect(rowTexts(element)).toEqual(['Nightly']);

            type(element, 'nothing like it');
            await Promise.resolve();
            expect(element.shadowRoot.querySelector('table')).toBeNull();
            expect(texts(element, '.sfdl-monitor-detail__empty')).toEqual(['Nothing listed goes by what is filtered.']);
            expect(element.shadowRoot.querySelector('.sfdl-monitor-detail__csv').disabled).toBe(true);

            search(element).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
            await Promise.resolve();
            expect(rowTexts(element).length).toBe(3);
        });

        it('saves the rows listed as a CSV, column for column', async () => {
            saveAs.mockReset();
            const element = createDetail();
            type(element, 'nightly');
            await Promise.resolve();

            click(element.shadowRoot.querySelector('.sfdl-monitor-detail__csv'));

            const [blob, fileName] = saveAs.mock.calls[0];
            expect(fileName).toBe('jobs-' + dayOf(new Date().toISOString()) + '.csv');
            const csv = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.readAsText(blob);
            });
            expect(csv).toBe('When,Class,Errors,Usage\r\n' + WHEN_A + ',Nightly,2,90\r\n' + WHEN_B + ',Nightly,1,50');
        });

        it('draws the first rows and more on asking', async () => {
            const items = Array.from({ length: 450 }, (unused, index) => ({ id: String(index), when: WHEN_A, apexClass: 'C', errors: index, percent: 0 }));
            const element = createDetail(items);
            const more = () => element.shadowRoot.querySelector('.sfdl-monitor-detail__more-rows');

            expect(element.shadowRoot.querySelectorAll('tbody tr').length).toBe(200);
            expect(more().textContent).toBe('Show 200 more of the 250 left');

            click(more());
            await Promise.resolve();
            expect(element.shadowRoot.querySelectorAll('tbody tr').length).toBe(400);
            expect(more().textContent).toBe('Show 50 more of the 50 left');

            click(more());
            await Promise.resolve();
            expect(element.shadowRoot.querySelectorAll('tbody tr').length).toBe(450);
            expect(more()).toBeNull();
        });
    });

    it('reads a cell of kind day as a day', () => {
        const element = createElement('sfdl-monitor-detail', { is: MonitorDetail });
        element.monitor = { ...MONITOR, columns: [{ key: 'day', label: 'Day', kind: 'day' }], groupings: [] };
        element.items = [{ id: '1', day: '2026-10-07' }, { id: '2', day: '' }];
        document.body.appendChild(element);

        expect(texts(element, 'tbody td')).toEqual(['07/10', '']);
    });

    it('draws the actions of the monitor on each row, asks for one with its row, and shows it busy', async () => {
        const element = createElement('sfdl-monitor-detail', { is: MonitorDetail });
        element.monitor = { ...MONITOR, actions: [{ key: 'download', label: 'Download', busyLabel: 'Downloading' }] };
        element.items = ITEMS;
        document.body.appendChild(element);
        const action = jest.fn();
        element.addEventListener('action', action);
        const buttons = () => element.shadowRoot.querySelectorAll('.sfdl-monitor-detail__action');

        expect(texts(element, '.sfdl-monitor-detail__action')).toEqual(['Download', 'Download', 'Download']);
        click(buttons()[1]);
        expect(action.mock.calls[0][0].detail).toEqual({ id: '2', action: 'download' });

        element.runningActions = ['2|download'];
        await Promise.resolve();

        expect(buttons()[1].textContent.trim()).toBe('Downloading');
        expect(buttons()[1].disabled).toBe(true);
        expect(buttons()[0].disabled).toBe(false);
    });

    it('draws no action column for a monitor without actions', () => {
        const element = createDetail();

        expect(element.shadowRoot.querySelector('.sfdl-monitor-detail__cell_actions')).toBeNull();
    });

    it('picks a bar with Enter, and not on a click that ends a selection of its words', async () => {
        const element = createDetail();
        const bars = () => element.shadowRoot.querySelectorAll('.sfdl-monitor-detail__bar-row');
        click(groupingButtons(element)[1]);
        await Promise.resolve();

        bars()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
        await Promise.resolve();
        expect(bars()[0].getAttribute('aria-pressed')).toBe('true');

        const range = document.createRange();
        range.selectNodeContents(bars()[1].querySelector('.sfdl-monitor-detail__bar-label'));
        window.getSelection().addRange(range);
        click(bars()[1]);
        await Promise.resolve();
        window.getSelection().removeAllRanges();

        expect(bars()[0].getAttribute('aria-pressed')).toBe('true');
        expect(bars()[1].getAttribute('aria-pressed')).toBe('false');
    });

    it('copies the rows listed as they read, a tab between the cells, and says so for a while', async () => {
        jest.useFakeTimers();
        const writeText = jest.fn(() => Promise.resolve());
        Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
        const element = createDetail();
        const copy = () => element.shadowRoot.querySelector('.sfdl-monitor-detail__copy');

        click(copy());
        for (let tick = 0; tick < 5; tick++) {
            // eslint-disable-next-line no-await-in-loop
            await Promise.resolve();
        }

        expect(writeText).toHaveBeenCalledWith(
            'When\tClass\tErrors\tUsage\n07/10 09:05\tNightly\t2\t90%\n09/10 18:30\tSync\t0\t10%\n09/10 18:30\tNightly\t1\t50%'
        );
        expect(copy().textContent.trim()).toBe('Copied');

        jest.advanceTimersByTime(2000);
        await Promise.resolve();
        expect(copy().textContent.trim()).toBe('Copy');
        jest.useRealTimers();
        delete navigator.clipboard;
    });

    it('draws on each row only the actions that row takes', () => {
        const element = createElement('sfdl-monitor-detail', { is: MonitorDetail });
        element.monitor = {
            ...MONITOR,
            actions: [
                { key: 'enable', label: 'Enable', isAvailable: (item) => item.errors === 0 },
                { key: 'disable', label: 'Disable', isAvailable: (item) => item.errors > 0 }
            ]
        };
        element.items = ITEMS;
        document.body.appendChild(element);
        const rows = element.shadowRoot.querySelectorAll('tbody tr');

        expect(texts(rows[0], '.sfdl-monitor-detail__action')).toEqual(['Disable']);
        expect(texts(rows[1], '.sfdl-monitor-detail__action')).toEqual(['Enable']);
    });
});
