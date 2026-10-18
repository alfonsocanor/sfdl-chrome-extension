import { createElement } from 'lwc';
import LogManipulationMenu from 'sfdl/logManipulationMenu';

function createMenu(properties = {}) {
    const element = createElement('sfdl-log-manipulation-menu', {
        is: LogManipulationMenu
    });
    Object.assign(element, properties);
    document.body.appendChild(element);
    return element;
}

const pills = (element) => [
    ...element.shadowRoot.querySelectorAll('.sfdl-log-filter__pill')
];
const pill = (element, name) =>
    element.shadowRoot.querySelector(
        `.sfdl-log-filter__pill[data-name="${name}"]`
    );

function flushPromises() {
    return Promise.resolve();
}

describe('sfdl-log-manipulation-menu', () => {
    it('starts with every manipulation option turned on', () => {
        const element = createMenu();

        expect(element.currentManipulationOptions()).toEqual([
            expect.objectContaining({
                name: 'methodEntryExitCodeUnitStartedFinished2Hierarchy',
                checked: true
            }),
            expect.objectContaining({
                name: 'removeHeapAllocateAndStatementExecute',
                checked: true
            }),
            expect.objectContaining({ name: 'removeFlowNoise', checked: true })
        ]);
    });

    it('shows one pill per option, named for what it does', () => {
        const element = createMenu();

        expect(pills(element).map((node) => node.textContent.trim())).toEqual([
            'Indent calls',
            'Hide heap and statements',
            'Hide flow noise'
        ]);
        expect(
            pills(element).every((node) =>
                node.classList.contains('sfdl-log-filter__pill_on')
            )
        ).toBe(true);
        expect(
            pills(element).map((node) => node.getAttribute('aria-pressed'))
        ).toEqual(['true', 'true', 'true']);
    });

    it('explains each option on hover', () => {
        const element = createMenu();
        const tooltip = pill(element, 'removeFlowNoise')
            .parentElement.querySelector('.sfdl-log-filter__tooltip');

        expect(tooltip.getAttribute('role')).toBe('tooltip');
        expect(tooltip.textContent).toContain('creating and finishing interviews');
    });

    it('starts from the options it is handed and leaves them untouched', () => {
        const options = [
            {
                label: 'Ignore times',
                name: 'ignoreTimestamps',
                checked: false
            }
        ];
        const element = createMenu({ options });
        const handler = jest.fn();
        element.addEventListener('checkboxselection', handler);

        pill(element, 'ignoreTimestamps').click();

        expect(handler.mock.calls[0][0].detail.manipulationOptions).toEqual([
            {
                label: 'Ignore times',
                name: 'ignoreTimestamps',
                checked: true
            }
        ]);
        expect(options[0].checked).toBe(false);
    });

    it('turns an option off and republishes the whole selection', async () => {
        const element = createMenu();
        const handler = jest.fn();
        element.addEventListener('checkboxselection', handler);

        pill(element, 'removeFlowNoise').click();
        await flushPromises();

        const { manipulationOptions } = handler.mock.calls[0][0].detail;
        expect(manipulationOptions).toHaveLength(3);
        expect(manipulationOptions).toContainEqual(
            expect.objectContaining({ name: 'removeFlowNoise', checked: false })
        );
        expect(element.currentManipulationOptions()).toContainEqual(
            expect.objectContaining({ name: 'removeFlowNoise', checked: false })
        );
        expect(
            pill(element, 'removeFlowNoise').classList.contains(
                'sfdl-log-filter__pill_on'
            )
        ).toBe(false);
        expect(
            pill(element, 'removeFlowNoise').getAttribute('aria-pressed')
        ).toBe('false');
    });

    it('turns an option back on with a second click', async () => {
        const element = createMenu();

        pill(element, 'removeFlowNoise').click();
        await flushPromises();
        pill(element, 'removeFlowNoise').click();
        await flushPromises();

        expect(
            element
                .currentManipulationOptions()
                .every((option) => option.checked)
        ).toBe(true);
    });
});
