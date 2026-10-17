import { createElement } from 'lwc';
import CompareResults from 'sfdl/compareResults';

const entry = (path, status) => ({ path, status });

const ENTRIES = [
    entry('classes/AccountService.cls', 'different'),
    entry('classes/AccountService.cls-meta.xml', 'identical'),
    entry('classes/InvoiceBatch.cls', 'left'),
    entry('classes/LegacyHelper.cls', 'right'),
    entry('classes/Utils.cls', 'identical')
];

function flushPromises() {
    return Promise.resolve();
}

function createResults(properties = {}) {
    const element = createElement('sfdl-compare-results', {
        is: CompareResults
    });
    Object.assign(element, {
        entries: ENTRIES,
        typeLabel: 'Apex Classes',
        leftName: 'acme.my.salesforce.com',
        rightName: 'globex.my.salesforce.com',
        ...properties
    });
    document.body.appendChild(element);
    return element;
}

const rows = (element) => [
    ...element.shadowRoot.querySelectorAll('.sfdl-compare-results__row')
];
const paths = (element) => rows(element).map((row) => row.dataset.path);
const filterButton = (element, value) =>
    element.shadowRoot.querySelector(`[data-filter="${value}"]`);
const summary = (element) =>
    element.shadowRoot.querySelector('.sfdl-compare-results__summary');

function click(node) {
    node.dispatchEvent(new CustomEvent('click'));
}

function type(node, value) {
    node.value = value;
    node.dispatchEvent(new CustomEvent('input'));
}

function pressKey(node, key) {
    const event = new CustomEvent('keydown', { cancelable: true });
    event.key = key;
    node.dispatchEvent(event);
}

describe('sfdl-compare-results', () => {
    it('opens on the changes', () => {
        const element = createResults();

        expect(paths(element)).toEqual([
            'classes/AccountService.cls',
            'classes/InvoiceBatch.cls',
            'classes/LegacyHelper.cls'
        ]);
        expect(
            filterButton(element, 'changes').getAttribute('aria-pressed')
        ).toBe('true');
        expect(summary(element)).toBeNull();
    });

    it('counts the components of every status', () => {
        const element = createResults();

        expect(
            [...element.shadowRoot.querySelectorAll('.sfdl-status-filter')].map(
                (button) => button.textContent.trim()
            )
        ).toEqual([
            'Changes 3',
            'Different 1',
            'Only left 1',
            'Only right 1',
            'Identical 2',
            'All 5'
        ]);
    });

    it('paints every status in its colour', () => {
        const element = createResults();

        expect(
            rows(element).map((row) => [
                row.querySelector('.sfdl-status-badge').textContent,
                row.querySelector('.sfdl-status-badge').className
            ])
        ).toEqual([
            ['Different', 'sfdl-status-badge sfdl-status-badge_different'],
            ['Only left', 'sfdl-status-badge sfdl-status-badge_left'],
            ['Only right', 'sfdl-status-badge sfdl-status-badge_right']
        ]);
        expect(rows(element)[1].title).toBe(
            'classes/InvoiceBatch.cls: only in acme.my.salesforce.com'
        );
    });

    it('shows the components of the status picked', async () => {
        const element = createResults();

        click(filterButton(element, 'identical'));
        await flushPromises();

        expect(paths(element)).toEqual([
            'classes/AccountService.cls-meta.xml',
            'classes/Utils.cls'
        ]);

        click(filterButton(element, 'all'));
        await flushPromises();

        expect(paths(element)).toHaveLength(5);
    });

    it('greys the folder out and keeps the name readable', () => {
        const element = createResults();

        expect(
            rows(element)[0].querySelector('.sfdl-compare-results__folder')
                .textContent
        ).toBe('classes/');
        expect(
            rows(element)[0]
                .querySelector('.sfdl-compare-results__path')
                .textContent.trim()
        ).toBe('classes/AccountService.cls');
    });

    it('filters by every word typed', async () => {
        const element = createResults();

        type(
            element.shadowRoot.querySelector('.sfdl-compare-results__filter'),
            'CLASSES invoice'
        );
        await flushPromises();

        expect(paths(element)).toEqual(['classes/InvoiceBatch.cls']);
    });

    it('says when nothing matches', async () => {
        const element = createResults();

        type(
            element.shadowRoot.querySelector('.sfdl-compare-results__filter'),
            'nothing'
        );
        await flushPromises();

        expect(
            element.shadowRoot.querySelector('.sfdl-compare-results__empty')
                .textContent
        ).toBe('No component matches the filter');
    });

    it('tells when both orgs are identical and lists every file', () => {
        const element = createResults({
            entries: [
                entry('classes/A.cls', 'identical'),
                entry('classes/B.cls', 'identical')
            ]
        });

        expect(summary(element).textContent).toBe(
            'No differences: the 2 Apex Classes are identical in both orgs.'
        );
        expect(summary(element).classList).toContain(
            'sfdl-compare-results__summary_identical'
        );
        expect(paths(element)).toEqual(['classes/A.cls', 'classes/B.cls']);
    });

    it('tells when neither org holds anything of the type', () => {
        const element = createResults({ entries: [] });

        expect(summary(element).textContent).toBe(
            'Neither org holds any Apex Classes.'
        );
    });

    it('opens a component when its row is clicked', () => {
        const element = createResults();
        const handleSelect = jest.fn();
        element.addEventListener('componentselect', handleSelect);

        click(rows(element)[1]);

        expect(handleSelect.mock.calls[0][0].detail).toEqual({
            path: 'classes/InvoiceBatch.cls'
        });
    });

    it('marks the component on screen', () => {
        const element = createResults({
            selectedPath: 'classes/LegacyHelper.cls'
        });

        expect(
            rows(element).map((row) =>
                row.classList.contains('sfdl-compare-results__row_selected')
            )
        ).toEqual([false, false, true]);
    });

    it('opens the next and the previous component with the arrows', () => {
        const element = createResults();
        const handleSelect = jest.fn();
        element.addEventListener('componentselect', handleSelect);

        pressKey(rows(element)[0], 'ArrowDown');
        pressKey(rows(element)[0], 'ArrowUp');

        expect(
            handleSelect.mock.calls.map(([event]) => event.detail.path)
        ).toEqual(['classes/InvoiceBatch.cls', 'classes/LegacyHelper.cls']);
    });

    it('shows a long list a page at a time', async () => {
        const manyEntries = Array.from({ length: 650 }, (value, index) =>
            entry(
                'objects/Account/fields/F' +
                    String(index).padStart(3, '0') +
                    '__c.field',
                'different'
            )
        );
        const element = createResults({ entries: manyEntries });
        const more = () =>
            element.shadowRoot.querySelector('.sfdl-compare-results__more');

        expect(rows(element)).toHaveLength(300);
        expect(more().textContent).toBe('Show 300 more of the 350 left');

        click(more());
        await flushPromises();
        expect(rows(element)).toHaveLength(600);
        expect(more().textContent).toBe('Show 50 more of the 50 left');

        click(more());
        await flushPromises();
        expect(rows(element)).toHaveLength(650);
        expect(more()).toBeNull();
    });

    it('opens on the changes again for a new comparison', async () => {
        const element = createResults();
        click(filterButton(element, 'identical'));
        await flushPromises();

        element.entries = [...ENTRIES];
        await flushPromises();

        expect(
            filterButton(element, 'changes').getAttribute('aria-pressed')
        ).toBe('true');
    });
});
