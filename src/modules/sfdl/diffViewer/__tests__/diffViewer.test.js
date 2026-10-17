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

    describe('summary bar', () => {
        const CHANGES = [
            {
                originalStartLineNumber: 3,
                originalEndLineNumber: 4,
                modifiedStartLineNumber: 3,
                modifiedEndLineNumber: 3
            },
            {
                originalStartLineNumber: 10,
                originalEndLineNumber: 0,
                modifiedStartLineNumber: 10,
                modifiedEndLineNumber: 12
            },
            {
                originalStartLineNumber: 20,
                originalEndLineNumber: 20,
                modifiedStartLineNumber: 19,
                modifiedEndLineNumber: 0
            }
        ];

        const count = (element) =>
            element.shadowRoot.querySelector('.sfdl-diff-count');
        const nextButton = (element) =>
            element.shadowRoot.querySelector('.sfdl-diff-next');
        const previousButton = (element) =>
            element.shadowRoot.querySelector('.sfdl-diff-previous');
        const identicalBanner = (element) =>
            element.shadowRoot.querySelector('.sfdl-diff-banner_identical');
        const revealedLines = () =>
            diffEditor()
                .getModifiedEditor()
                .revealLineInCenter.mock.calls.map(([line]) => line);

        function click(node) {
            node.dispatchEvent(new CustomEvent('click'));
        }

        function toggle(node, checked) {
            node.checked = checked;
            node.dispatchEvent(new CustomEvent('change'));
        }

        async function compare(properties = {}) {
            return createDiffViewer({
                leftContent: 'left',
                rightContent: 'right',
                leftLabel: 'acme.my.salesforce.com',
                rightLabel: 'globex.my.salesforce.com',
                ...properties
            });
        }

        it('names each side in its colour', async () => {
            const element = await compare();

            const leftLabel = element.shadowRoot.querySelector(
                '.sfdl-diff-left-label'
            );
            const rightLabel = element.shadowRoot.querySelector(
                '.sfdl-diff-right-label'
            );
            expect(leftLabel.textContent.trim()).toBe('acme.my.salesforce.com');
            expect(leftLabel.classList.contains('sfdl-side-chip_left')).toBe(
                true
            );
            expect(rightLabel.textContent.trim()).toBe(
                'globex.my.salesforce.com'
            );
            expect(rightLabel.classList.contains('sfdl-side-chip_right')).toBe(
                true
            );
        });

        it('says it is comparing until the diff is computed', async () => {
            const element = await compare();

            expect(count(element).textContent).toBe('Comparing...');
            expect(nextButton(element).disabled).toBe(true);
        });

        it('counts the differences and opens on the first one', async () => {
            const element = await compare();

            diffEditor().mockDiffComputed(CHANGES);
            await flushPromises();

            expect(count(element).textContent).toBe('1 of 3 differences');
            expect(count(element).title).toBe(
                '3 lines on the left and 4 lines on the right differ'
            );
            expect(revealedLines()).toEqual([3]);
            expect(nextButton(element).disabled).toBe(false);
        });

        it('walks the differences both ways and wraps around', async () => {
            const element = await compare();
            diffEditor().mockDiffComputed(CHANGES);
            await flushPromises();

            click(nextButton(element));
            click(nextButton(element));
            click(nextButton(element));
            click(previousButton(element));
            await flushPromises();

            expect(revealedLines()).toEqual([3, 10, 19, 3, 19]);
            expect(count(element).textContent).toBe('3 of 3 differences');
        });

        it('tells when both sides are identical', async () => {
            const element = await compare({
                leftContent: 'same',
                rightContent: 'same'
            });

            diffEditor().mockDiffComputed([]);
            await flushPromises();

            expect(count(element).textContent).toBe('No differences');
            expect(identicalBanner(element).textContent).toContain(
                'Both sides are identical.'
            );
            expect(nextButton(element).disabled).toBe(true);
        });

        it('tells when the sides only differ in whitespace', async () => {
            const element = await compare({
                leftContent: 'same',
                rightContent: '  same'
            });

            toggle(
                element.shadowRoot.querySelector('.sfdl-diff-whitespace'),
                true
            );
            diffEditor().mockDiffComputed([]);
            await flushPromises();

            expect(diffEditor().updateOptions).toHaveBeenCalledWith({
                ignoreTrimWhitespace: true
            });
            expect(identicalBanner(element).textContent).toContain(
                'The sides only differ in whitespace.'
            );
        });

        it('takes the explanation of the parent for identical sides', async () => {
            const element = await compare({
                identicalMessage: 'The class is the same in both orgs.'
            });

            diffEditor().mockDiffComputed([]);
            await flushPromises();

            expect(identicalBanner(element).textContent).toContain(
                'The class is the same in both orgs.'
            );
        });

        it('hides the banner while there are differences', async () => {
            const element = await compare();

            diffEditor().mockDiffComputed(CHANGES);
            await flushPromises();

            expect(identicalBanner(element)).toBeNull();
        });

        it('switches between side by side and inline', async () => {
            const element = await compare();

            toggle(element.shadowRoot.querySelector('.sfdl-diff-inline'), true);

            expect(diffEditor().updateOptions).toHaveBeenCalledWith({
                renderSideBySide: false
            });
        });

        it('shows the notice of the parent above the diff', async () => {
            const element = await compare({
                notice: 'Only in acme.my.salesforce.com'
            });

            expect(
                element.shadowRoot.querySelector('.sfdl-diff-banner_notice')
                    .textContent
            ).toBe('Only in acme.my.salesforce.com');
        });

        it('starts counting again when the content changes', async () => {
            const element = await compare();
            diffEditor().mockDiffComputed(CHANGES);
            await flushPromises();

            element.rightContent = 'something else';
            await flushPromises();
            await flushPromises();

            expect(count(element).textContent).toBe('Comparing...');
        });
    });
});
