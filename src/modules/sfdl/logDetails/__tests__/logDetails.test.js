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
        orgPicked: true,
        ...props
    });
    document.body.appendChild(element);
    return element;
}

const manipulationMenu = (element) =>
    element.shadowRoot.querySelector('sfdl-log-manipulation-menu');
const message = (element) =>
    element.shadowRoot.querySelector('.sfdl-log-details__message');

describe('sfdl-log-details', () => {
    it('asks for the org of the logs, with no filters and no name, until one is picked', () => {
        const element = createLogDetails({ orgPicked: false });

        expect(message(element).textContent).toBe('Pick the org of the logs.');
        expect(manipulationMenu(element)).toBeNull();
        expect(element.shadowRoot.querySelector('.slds-panel__header')).toBeNull();
    });

    it('shows the filters and the name of the log once an org is picked', async () => {
        const element = createLogDetails({ orgPicked: false });

        element.orgPicked = true;
        await wait(0);

        expect(message(element)).toBeNull();
        expect(manipulationMenu(element)).not.toBeNull();
        expect(element.shadowRoot.querySelector('.slds-panel__header')).not.toBeNull();
    });

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

    it('draws the lines of a log where the editor will be while it is processed', async () => {
        const element = createLogDetails();

        element.processLogsFromLogList(
            { response: 'USER_DEBUG|hello' },
            'a log'
        );
        await Promise.resolve();

        expect(
            element.shadowRoot.querySelector('sfdl-loading-stencil').type
        ).toBe('log');
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

    it('leaves folding the log list to its own panel', () => {
        const element = createLogDetails();

        expect(
            element.shadowRoot.querySelector('button[title="Toggle panel"]')
        ).toBeNull();
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
