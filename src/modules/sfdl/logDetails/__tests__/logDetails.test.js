import { createElement } from 'lwc';
import LogDetails from 'sfdl/logDetails';
import * as monaco from 'monaco-editor';

function wait(milliseconds = 250) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function createLogDetails(props = {}) {
    const element = createElement('sfdl-log-details', { is: LogDetails });
    Object.assign(element, {
        isAnaliseLogs: true,
        showLogListSection: true,
        ...props
    });
    document.body.appendChild(element);
    return element;
}

function click(node) {
    node.dispatchEvent(
        new CustomEvent('click', { bubbles: true, composed: true })
    );
}

const toggleButton = (element) => element.shadowRoot.querySelector('button');
const manipulationMenu = (element) =>
    element.shadowRoot.querySelector('sfdl-log-manipulation-menu');

describe('sfdl-log-details', () => {
    it('teaches monaco the apexlog language and the sfdl theme', () => {
        createLogDetails();

        expect(monaco.languages.register).toHaveBeenCalledWith({
            id: 'apexlog'
        });
        expect(monaco.languages.setMonarchTokensProvider).toHaveBeenCalledWith(
            'apexlog',
            expect.any(Object)
        );
        expect(monaco.editor.defineTheme).toHaveBeenCalledWith(
            'customDawn',
            expect.any(Object)
        );
    });

    it('starts with no editor and no log name', () => {
        const element = createLogDetails();

        expect(
            element.shadowRoot.querySelector('.sfdlMonacoEditor')
        ).toBeNull();
        expect(element.shadowRoot.querySelector('span').textContent).toBe('');
    });

    it('shows a spinner while the log is being processed', async () => {
        const element = createLogDetails();

        element.processLogsFromLogList(
            { response: 'USER_DEBUG|hello' },
            'a log'
        );
        await Promise.resolve();

        expect(element.shadowRoot.querySelector('sfdl-spinner')).not.toBeNull();
    });

    it('renders the log in a monaco editor with the checked filters applied', async () => {
        const element = createLogDetails();

        await element.processLogsFromLogList(
            { response: '|HEAP_ALLOCATE|noise\n|USER_DEBUG|signal' },
            'John Doe | a log'
        );
        await wait();

        expect(monaco.editor.create).toHaveBeenCalledTimes(1);
        const [, options] = monaco.editor.create.mock.calls[0];
        expect(options.language).toBe('apexlog');
        expect(options.theme).toBe('customDawn');
        expect(options.value).toBe('|USER_DEBUG|signal');
        expect(element.shadowRoot.querySelector('span').textContent).toBe(
            'John Doe | a log'
        );
    });

    it('re-renders the log when the filters change and republishes them', async () => {
        const element = createLogDetails();
        const handler = jest.fn();
        element.addEventListener('manipulationoptions', handler);
        await element.processLogsFromLogList(
            { response: '|USER_DEBUG|signal' },
            'a log'
        );
        await wait();
        monaco.editor.create.mockClear();

        const manipulationOptions = [
            {
                label: 'HEAP',
                name: 'removeHeapAllocateAndStatementExecute',
                checked: false
            }
        ];
        manipulationMenu(element).dispatchEvent(
            new CustomEvent('checkboxselection', {
                detail: { manipulationOptions }
            })
        );
        await wait();

        expect(handler.mock.calls[0][0].detail).toEqual({
            manipulationOptions
        });
        expect(monaco.editor.create).toHaveBeenCalledTimes(1);
    });

    it('asks the console to collapse and expand the log list', () => {
        const element = createLogDetails({ showLogListSection: true });
        const handler = jest.fn();
        element.addEventListener('displayloglistsection', handler);

        click(toggleButton(element));

        expect(handler.mock.calls[0][0].detail).toEqual({
            classAction: 'remove'
        });
    });

    it('asks the console to expand the log list when it is already collapsed', () => {
        const element = createLogDetails({ showLogListSection: false });
        const handler = jest.fn();
        element.addEventListener('displayloglistsection', handler);

        click(toggleButton(element));

        expect(handler.mock.calls[0][0].detail).toEqual({ classAction: 'add' });
    });

    it('sizes the editor to the space the console gives it', async () => {
        const element = createLogDetails();
        element.setMonacoEditorHeight(420);

        await element.processLogsFromLogList({ response: 'body' }, 'a log');
        await wait();

        expect(
            element.shadowRoot
                .querySelector('.sfdlMonacoEditor')
                .getAttribute('style')
        ).toBe('height: 420px');
    });

    it('clears the editor when the org changes', async () => {
        const element = createLogDetails();
        await element.processLogsFromLogList({ response: 'body' }, 'a log');
        await wait();

        element.hideMonacoEditor();
        await wait(0);

        expect(
            element.shadowRoot.querySelector('.sfdlMonacoEditor')
        ).toBeNull();
        expect(element.shadowRoot.querySelector('span').textContent).toBe('');
    });
});
