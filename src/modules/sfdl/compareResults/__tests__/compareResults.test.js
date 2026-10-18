import { createElement } from 'lwc';
import CompareResults from 'sfdl/compareResults';

const component = (name, status, extra = {}) => ({
    name,
    presence:
        status === 'left' ? 'left' : status === 'right' ? 'right' : 'both',
    status,
    ...extra
});

const COMPONENTS = [
    component('AccountService', 'different', {
        files: [
            { path: 'classes/AccountService.cls', status: 'different' },
            { path: 'classes/AccountService.cls-meta.xml', status: 'identical' }
        ],
        leftModified: { date: '2026-10-12T09:30:00.000Z', by: 'Jane Roe' },
        rightModified: { date: '2026-10-15T16:05:00.000Z', by: 'John Doe' }
    }),
    component('InvoiceBatch', 'left'),
    component('LegacyHelper', 'right'),
    component('Utils', 'notCompared'),
    component('Zeta', 'identical', {
        files: [{ path: 'classes/Zeta.cls', status: 'identical' }]
    })
];

function flushPromises() {
    return Promise.resolve();
}

function createResults(properties = {}) {
    const element = createElement('sfdl-compare-results', {
        is: CompareResults
    });
    Object.assign(element, {
        components: COMPONENTS,
        typeLabel: 'Apex Classes',
        ...properties
    });
    document.body.appendChild(element);
    return element;
}

const rows = (element) => [
    ...element.shadowRoot.querySelectorAll('.sfdl-compare-results__row')
];
const names = (element) =>
    [...element.shadowRoot.querySelectorAll('.sfdl-compare-results__open')].map(
        (button) => button.dataset.name
    );
const checkboxes = (element) => [
    ...element.shadowRoot.querySelectorAll('.sfdl-compare-results__checkbox')
];
const filterButton = (element, value) =>
    element.shadowRoot.querySelector(`[data-filter="${value}"]`);
const compareButton = (element) =>
    element.shadowRoot.querySelector('.sfdl-compare-results__compare');
const cost = (element) =>
    element.shadowRoot.querySelector('.sfdl-compare-results__cost').textContent;
const summary = (element) =>
    element.shadowRoot.querySelector('.sfdl-compare-results__summary');

// The badge and the name, the template keeps no whitespace between them.
const fileText = (file) =>
    file.querySelector('.sfdl-status-badge').textContent +
    ' ' +
    file.querySelector('.sfdl-compare-results__name').textContent;

function click(node) {
    node.dispatchEvent(new CustomEvent('click'));
}

function check(node, checked) {
    node.checked = checked;
    node.dispatchEvent(new CustomEvent('change'));
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
    describe('the list', () => {
        it('lists every component either org holds', () => {
            const element = createResults();

            expect(names(element)).toEqual([
                'AccountService',
                'InvoiceBatch',
                'LegacyHelper',
                'Utils',
                'Zeta'
            ]);
        });

        it('tells what is known of each component', () => {
            const element = createResults();

            expect(
                rows(element).map(
                    (row) => row.querySelector('.sfdl-status-badge').textContent
                )
            ).toEqual([
                'Different',
                'Only left',
                'Only right',
                'In both',
                'Identical'
            ]);
            expect(
                rows(element)[3].querySelector('.sfdl-status-badge').className
            ).toBe('sfdl-status-badge sfdl-status-badge_pending');
        });

        it('says when and by whom each org last changed a component', () => {
            const element = createResults();
            const title = rows(element)[0].querySelector(
                '.sfdl-compare-results__open'
            ).title;
            const pad = (value) => String(value).padStart(2, '0');
            const local = (iso) => {
                const date = new Date(iso);
                return (
                    pad(date.getDate()) +
                    '/' +
                    pad(date.getMonth() + 1) +
                    '/' +
                    date.getFullYear() +
                    ' ' +
                    pad(date.getHours()) +
                    ':' +
                    pad(date.getMinutes())
                );
            };

            expect(title).toBe(
                'AccountService\nLeft: modified ' +
                    local('2026-10-12T09:30:00.000Z') +
                    ' by Jane Roe\nRight: modified ' +
                    local('2026-10-15T16:05:00.000Z') +
                    ' by John Doe'
            );
        });

        it('only filters on what the listings tell, which org holds a component', () => {
            const element = createResults();

            expect(
                [
                    ...element.shadowRoot.querySelectorAll(
                        '.sfdl-status-filter'
                    )
                ].map((button) => button.textContent.trim())
            ).toEqual(['All 5', 'Only left 1', 'Only right 1']);
        });

        it('shows the components only one org holds', async () => {
            const element = createResults();

            click(filterButton(element, 'right'));
            await flushPromises();

            expect(names(element)).toEqual(['LegacyHelper']);

            click(filterButton(element, 'all'));
            await flushPromises();

            expect(names(element)).toHaveLength(5);
        });

        it('filters by every word typed', async () => {
            const element = createResults();

            type(
                element.shadowRoot.querySelector(
                    '.sfdl-compare-results__filter'
                ),
                'SERVICE account'
            );
            await flushPromises();

            expect(names(element)).toEqual(['AccountService']);
        });

        it('tells when neither org holds anything of the type', () => {
            const element = createResults({ components: [] });

            expect(summary(element).textContent).toBe(
                'Neither org holds any Apex Classes.'
            );
        });

        it('tells when every component was compared and nothing differs', () => {
            const element = createResults({
                components: [
                    component('A', 'identical'),
                    component('B', 'identical')
                ]
            });

            expect(summary(element).textContent).toBe(
                'No differences: the 2 Apex Classes are identical in both orgs.'
            );
        });

        it('says nothing about differences before everything was compared', () => {
            const element = createResults({
                components: [
                    component('A', 'identical'),
                    component('B', 'notCompared')
                ]
            });

            expect(summary(element)).toBeNull();
        });

        it('does not take a component no org handed back for an identical one', () => {
            const element = createResults({
                components: [
                    component('Account', 'identical'),
                    component('Contact', 'unavailable')
                ]
            });

            expect(summary(element)).toBeNull();
            expect(
                rows(element)[1].querySelector('.sfdl-status-badge').textContent
            ).toBe('Not retrieved');
        });

        it('shows a long list a page at a time', async () => {
            const many = Array.from({ length: 350 }, (value, index) =>
                component(
                    'Class' + String(index).padStart(3, '0'),
                    'notCompared'
                )
            );
            const element = createResults({ components: many });

            expect(rows(element)).toHaveLength(300);

            click(
                element.shadowRoot.querySelector('.sfdl-compare-results__more')
            );
            await flushPromises();

            expect(rows(element)).toHaveLength(350);
        });
    });

    describe('opening a component', () => {
        it('asks for the component clicked', () => {
            const element = createResults();
            const handleOpen = jest.fn();
            element.addEventListener('componentopen', handleOpen);

            click(
                element.shadowRoot.querySelectorAll(
                    '.sfdl-compare-results__open'
                )[3]
            );

            expect(handleOpen.mock.calls[0][0].detail).toEqual({
                name: 'Utils'
            });
        });

        it('lists the files of the component on screen', () => {
            const element = createResults({
                selectedName: 'AccountService',
                selectedPath: 'classes/AccountService.cls'
            });
            const files = [
                ...element.shadowRoot.querySelectorAll(
                    '.sfdl-compare-results__file'
                )
            ];

            expect(
                files.map((file) => [
                    fileText(file),
                    file.classList.contains(
                        'sfdl-compare-results__file_selected'
                    )
                ])
            ).toEqual([
                ['Different AccountService.cls', true],
                ['Identical AccountService.cls-meta.xml', false]
            ]);
            expect(rows(element)[0].classList).toContain(
                'sfdl-compare-results__row_selected'
            );
        });

        it('names the files of a folder component from inside it', () => {
            const element = createResults({
                components: [
                    component('Account', 'different', {
                        files: [
                            {
                                path: 'objects/Account/fields/Tier__c.field',
                                status: 'different'
                            }
                        ]
                    })
                ],
                selectedName: 'Account'
            });

            expect(
                fileText(
                    element.shadowRoot.querySelector(
                        '.sfdl-compare-results__file'
                    )
                )
            ).toBe('Different fields/Tier__c.field');
        });

        it('opens the file clicked', () => {
            const element = createResults({ selectedName: 'AccountService' });
            const handleFile = jest.fn();
            element.addEventListener('fileopen', handleFile);

            click(
                element.shadowRoot.querySelectorAll(
                    '.sfdl-compare-results__file'
                )[1]
            );

            expect(handleFile.mock.calls[0][0].detail).toEqual({
                name: 'AccountService',
                path: 'classes/AccountService.cls-meta.xml'
            });
        });

        it('opens the next and the previous component with the arrows', () => {
            const element = createResults();
            const handleOpen = jest.fn();
            element.addEventListener('componentopen', handleOpen);
            const firstRow = element.shadowRoot.querySelector(
                '.sfdl-compare-results__open'
            );

            pressKey(firstRow, 'ArrowDown');
            pressKey(firstRow, 'ArrowUp');

            expect(
                handleOpen.mock.calls.map(([event]) => event.detail.name)
            ).toEqual(['InvoiceBatch', 'Zeta']);
        });
    });

    describe('comparing a selection', () => {
        it('cannot compare before anything is ticked', () => {
            const element = createResults();

            expect(compareButton(element).disabled).toBe(true);
            expect(compareButton(element).textContent.trim()).toBe(
                'Compare selected'
            );
            expect(cost(element)).toBe('');
        });

        it('compares the components ticked and says what it costs', async () => {
            const element = createResults();
            const handleCompare = jest.fn();
            element.addEventListener('comparerequest', handleCompare);

            check(checkboxes(element)[3], true);
            check(checkboxes(element)[0], true);
            await flushPromises();

            expect(compareButton(element).textContent.trim()).toBe(
                'Compare selected (2)'
            );
            expect(cost(element)).toBe('1 retrieve per org');

            click(compareButton(element));
            await flushPromises();

            expect(handleCompare.mock.calls[0][0].detail).toEqual({
                names: ['AccountService', 'Utils']
            });
            expect(checkboxes(element).some((box) => box.checked)).toBe(false);
        });

        it('counts the retrieves of a big selection', async () => {
            const many = Array.from({ length: 25 }, (value, index) =>
                component('Object' + index + '__c', 'notCompared')
            );
            const element = createResults({ components: many, batchSize: 10 });

            check(
                element.shadowRoot.querySelector(
                    '.sfdl-compare-results__select-all'
                ),
                true
            );
            await flushPromises();

            expect(cost(element)).toBe('3 retrieves per org');
        });

        it('counts the api calls of custom settings', async () => {
            const element = createResults({ engine: 'customSettings' });

            check(checkboxes(element)[0], true);
            check(checkboxes(element)[1], true);
            await flushPromises();

            expect(cost(element)).toBe('4 api calls per org');
        });

        it('ticks every component shown, and only those', async () => {
            const element = createResults();
            const handleCompare = jest.fn();
            element.addEventListener('comparerequest', handleCompare);
            click(filterButton(element, 'left'));
            await flushPromises();

            check(
                element.shadowRoot.querySelector(
                    '.sfdl-compare-results__select-all'
                ),
                true
            );
            click(compareButton(element));

            expect(handleCompare.mock.calls[0][0].detail.names).toEqual([
                'InvoiceBatch'
            ]);
        });

        it('leaves a component being compared out of the selection', async () => {
            const element = createResults({
                components: [
                    component('A', 'comparing'),
                    component('B', 'notCompared')
                ]
            });
            const handleCompare = jest.fn();
            element.addEventListener('comparerequest', handleCompare);

            expect(checkboxes(element)[0].disabled).toBe(true);

            check(
                element.shadowRoot.querySelector(
                    '.sfdl-compare-results__select-all'
                ),
                true
            );
            click(compareButton(element));

            expect(handleCompare.mock.calls[0][0].detail.names).toEqual(['B']);
        });

        it('keeps the selection when a component of the same listing is compared', async () => {
            const element = createResults();
            check(checkboxes(element)[3], true);
            await flushPromises();

            element.components = COMPONENTS.map((item) =>
                item.name === 'InvoiceBatch' ? { ...item, files: [] } : item
            );
            await flushPromises();

            expect(checkboxes(element)[3].checked).toBe(true);
        });

        it('starts over with a new listing', async () => {
            const element = createResults();
            check(checkboxes(element)[3], true);
            click(filterButton(element, 'left'));
            await flushPromises();

            element.components = [component('Other', 'notCompared')];
            await flushPromises();

            expect(
                filterButton(element, 'all').getAttribute('aria-pressed')
            ).toBe('true');
            expect(compareButton(element).disabled).toBe(true);
        });
    });
});
