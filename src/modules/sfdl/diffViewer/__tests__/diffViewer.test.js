import { createElement } from 'lwc';
import * as monaco from 'monaco-editor';
import DiffViewer from 'sfdl/diffViewer';

function flushPromises() {
    return Promise.resolve();
}

async function createDiffViewer(properties = {}) {
    const element = createElement('sfdl-diff-viewer', { is: DiffViewer });
    Object.assign(element, properties);
    document.body.appendChild(element);
    await flushPromises();
    return element;
}

const editorContainer = (element) =>
    element.shadowRoot.querySelector('.sfdl-diff-editor');
const emptyState = (element) =>
    element.shadowRoot.querySelector('.sfdl-diff-empty');
const diffEditor = () => monaco.editor.createDiffEditor.mock.results[0].value;

describe('sfdl-diff-viewer', () => {
    describe('empty state', () => {
        it('explains what to do while there is nothing to compare', async () => {
            const element = await createDiffViewer({
                emptyMessage: 'Pick two logs to compare'
            });

            expect(emptyState(element).textContent).toBe(
                'Pick two logs to compare'
            );
            expect(
                editorContainer(element).classList.contains('slds-hide')
            ).toBe(true);
            expect(monaco.editor.createDiffEditor).not.toHaveBeenCalled();
        });

        it('shows the spinner while the content is loading', async () => {
            const element = await createDiffViewer({ loading: true });

            expect(
                element.shadowRoot.querySelector('sfdl-spinner')
            ).not.toBeNull();
        });
    });

    describe('comparing', () => {
        it('compares the left content against the right content', async () => {
            const element = await createDiffViewer({
                leftContent: 'left body',
                rightContent: 'right body',
                language: 'apex'
            });

            expect(emptyState(element)).toBeNull();
            expect(monaco.editor.createDiffEditor).toHaveBeenCalledWith(
                editorContainer(element),
                expect.objectContaining({
                    readOnly: true,
                    renderSideBySide: true,
                    theme: 'customDawn'
                })
            );
            expect(monaco.editor.createModel.mock.calls).toEqual([
                ['left body', 'apex'],
                ['right body', 'apex']
            ]);
            expect(diffEditor().setModel).toHaveBeenCalledWith({
                original: monaco.editor.createModel.mock.results[0].value,
                modified: monaco.editor.createModel.mock.results[1].value
            });
        });

        it('treats a missing side as empty', async () => {
            await createDiffViewer({ leftContent: 'only on the left' });

            expect(monaco.editor.createModel.mock.calls).toEqual([
                ['only on the left', 'plaintext'],
                ['', 'plaintext']
            ]);
        });

        it('reuses the editor and disposes the previous models', async () => {
            const element = await createDiffViewer({
                leftContent: 'a',
                rightContent: 'b'
            });
            const [firstOriginal, firstModified] =
                monaco.editor.createModel.mock.results.map(
                    ({ value }) => value
                );

            element.rightContent = 'c';
            await flushPromises();

            expect(monaco.editor.createDiffEditor).toHaveBeenCalledTimes(1);
            expect(diffEditor().setModel).toHaveBeenCalledTimes(2);
            expect(firstOriginal.dispose).toHaveBeenCalled();
            expect(firstModified.dispose).toHaveBeenCalled();
        });

        it('sets up the apex log language and the theme once it compares', async () => {
            await createDiffViewer({ leftContent: 'a', rightContent: 'b' });

            expect(monaco.languages.register).toHaveBeenCalledWith({
                id: 'apexlog'
            });
            expect(monaco.editor.defineTheme).toHaveBeenCalledWith(
                'customDawn',
                expect.objectContaining({
                    colors: expect.objectContaining({
                        'diffEditor.removedLineBackground': expect.any(String),
                        'diffEditor.insertedLineBackground': expect.any(String)
                    })
                })
            );
        });

        it('leaves the apex log language alone when it is already registered', async () => {
            monaco.languages.getLanguages.mockReturnValueOnce([
                { id: 'apexlog' }
            ]);

            await createDiffViewer({ leftContent: 'a', rightContent: 'b' });

            expect(monaco.languages.register).not.toHaveBeenCalled();
        });

        it('disposes the editor and its models when it is removed', async () => {
            const element = await createDiffViewer({
                leftContent: 'a',
                rightContent: 'b'
            });

            document.body.removeChild(element);

            expect(diffEditor().dispose).toHaveBeenCalled();
            monaco.editor.createModel.mock.results.forEach(({ value }) =>
                expect(value.dispose).toHaveBeenCalled()
            );
        });

        it('takes the height it is given', async () => {
            const element = await createDiffViewer({ height: 480 });

            expect(
                element.shadowRoot.querySelector('.sfdl-diff-viewer').style
                    .height
            ).toBe('480px');
        });
    });
});
