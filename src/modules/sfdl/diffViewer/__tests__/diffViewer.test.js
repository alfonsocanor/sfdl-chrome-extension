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

        it('writes the message under the spinner while loading, not behind it', async () => {
            const element = await createDiffViewer({
                loading: true,
                emptyMessage: 'Retrieving Utils from both orgs...'
            });

            expect(
                element.shadowRoot.querySelector('sfdl-spinner').message
            ).toBe('Retrieving Utils from both orgs...');
            expect(emptyState(element)).toBeNull();
        });

        it('only spins over a diff already on screen', async () => {
            const element = await createDiffViewer({
                loading: true,
                leftContent: 'a',
                rightContent: 'b',
                emptyMessage: 'Retrieving Utils from both orgs...'
            });

            expect(
                element.shadowRoot.querySelector('sfdl-spinner').message
            ).toBeUndefined();
        });
    });

    describe('the bar', () => {
        const count = (element) =>
            element.shadowRoot.querySelector('.sfdl-diff-count');

        it('stays with nothing to compare, without its controls', async () => {
            const element = await createDiffViewer({
                emptyMessage: 'Pick the two orgs to compare.'
            });

            expect(
                element.shadowRoot.querySelector('.sfdl-diff-summary')
            ).not.toBeNull();
            expect(
                element.shadowRoot.querySelector('.sfdl-diff-left-label')
            ).toBeNull();
            expect(
                element.shadowRoot.querySelector('.sfdl-diff-right-label')
            ).toBeNull();
            expect(
                element.shadowRoot.querySelector('.sfdl-diff-summary__actions')
            ).not.toBeNull();
            expect(count(element)).toBeNull();
            expect(
                element.shadowRoot.querySelector('.sfdl-diff-next')
            ).toBeNull();
            expect(
                element.shadowRoot.querySelector('.sfdl-diff-inline')
            ).toBeNull();
            expect(
                element.shadowRoot.querySelector('.sfdl-diff-whitespace')
            ).toBeNull();
        });

        it('writes what the org of each side is doing next to its name', async () => {
            const element = await createDiffViewer({
                leftLabel: 'acme.my.salesforce.com',
                rightLabel: 'acme--uat.sandbox.my.salesforce.com',
                leftStatus: { label: 'Retrieving', title: 'Retrieving' },
                rightStatus: {
                    label: 'INVALID_SESSION_ID',
                    title: 'INVALID_SESSION_ID: Invalid Session ID',
                    tone: 'error'
                }
            });
            const status = (side) =>
                element.shadowRoot.querySelector(
                    `.sfdl-diff-side-status[data-side="${side}"]`
                );

            expect(status('left').textContent).toBe('Retrieving');
            expect(status('left').previousElementSibling.classList).toContain(
                'sfdl-diff-left-label'
            );
            expect(status('right').className).toBe(
                'sfdl-diff-side-status sfdl-diff-side-status_error'
            );
            expect(status('right').title).toBe(
                'INVALID_SESSION_ID: Invalid Session ID'
            );
            expect(status('right').nextElementSibling.classList).toContain(
                'sfdl-diff-right-label'
            );
        });

        it('only says it is comparing while the first comparison loads', async () => {
            const element = await createDiffViewer({ loading: true });

            expect(count(element).textContent).toBe('Comparing...');
            expect(
                element.shadowRoot.querySelector('.sfdl-diff-inline')
            ).toBeNull();
            expect(
                element.shadowRoot.querySelector('.sfdl-diff-whitespace')
            ).toBeNull();
        });

        it('says it is comparing over a diff on screen while loading again', async () => {
            const element = await createDiffViewer({
                leftContent: 'same',
                rightContent: 'same'
            });
            diffEditor().mockDiffComputed([]);
            await flushPromises();

            element.loading = true;
            await flushPromises();

            expect(count(element).textContent).toBe('Comparing...');
            expect(
                element.shadowRoot.querySelector('.sfdl-diff-count_identical')
            ).toBeNull();
            expect(
                element.shadowRoot.querySelector('.sfdl-diff-inline')
            ).toBeNull();
        });

        it('forgets the differences of a comparison that went away', async () => {
            const element = await createDiffViewer({
                leftContent: 'a',
                rightContent: 'b'
            });
            diffEditor().mockDiffComputed([
                {
                    originalStartLineNumber: 1,
                    originalEndLineNumber: 1,
                    modifiedStartLineNumber: 1,
                    modifiedEndLineNumber: 1
                }
            ]);
            await flushPromises();
            expect(count(element).textContent).toBe('1 of 1 difference');

            element.leftContent = undefined;
            element.rightContent = undefined;
            await flushPromises();

            expect(count(element)).toBeNull();
            expect(
                element.shadowRoot.querySelector('.sfdl-diff-next')
            ).toBeNull();
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
            element.shadowRoot.querySelector('.sfdl-diff-count_identical');
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
            expect(nextButton(element)).toBeNull();
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

            expect(count(element).textContent).toContain('No differences.');
            expect(identicalBanner(element).textContent).toContain(
                'Both sides are identical.'
            );
            expect(nextButton(element)).toBeNull();
            expect(previousButton(element)).toBeNull();
            expect(
                element.shadowRoot.querySelector('.sfdl-diff-inline')
            ).toBeNull();
            expect(
                element.shadowRoot.querySelector('.sfdl-diff-whitespace')
            ).toBeNull();
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
            expect(
                element.shadowRoot.querySelector('.sfdl-diff-whitespace')
                    .checked
            ).toBe(true);
            expect(
                element.shadowRoot.querySelector('.sfdl-diff-inline')
            ).toBeNull();
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

        it('tells it in the bar, where the differences are counted', async () => {
            const element = await compare({
                leftContent: 'same',
                rightContent: 'same',
                identicalMessage: 'classes/Utils.cls is identical in both orgs.'
            });

            diffEditor().mockDiffComputed([]);
            await flushPromises();

            const identical = identicalBanner(element);
            expect(identical.parentElement.classList).toContain(
                'sfdl-diff-summary__center'
            );
            expect(identical.title).toBe(
                'No differences. classes/Utils.cls is identical in both orgs.'
            );
            expect(count(element)).toBe(identical);
            expect(
                element.shadowRoot.querySelector('.sfdl-diff-banner')
            ).toBeNull();
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

    describe('one side loading again', () => {
        const sideLoading = (element) =>
            element.shadowRoot.querySelector('.sfdl-diff-side-loading');

        async function loadSide(side, properties = {}) {
            return createDiffViewer({
                leftContent: 'kept',
                rightContent: 'kept',
                loadingSide: side,
                sideLoadingMessage: 'Comparing with acme--qa...',
                ...properties
            });
        }

        it('spins over the pane of that side only', async () => {
            const element = await loadSide('right');

            expect(sideLoading(element).style.left).toBe('50%');
            expect(sideLoading(element).style.right).toBe('0px');
            expect(
                sideLoading(element).querySelector('sfdl-spinner').message
            ).toBe('Comparing with acme--qa...');
            expect(
                element.shadowRoot.querySelector('.sfdl-diff-empty')
            ).toBeNull();
        });

        it('follows the split where monaco lays it out', async () => {
            const element = await loadSide('left');

            diffEditor().getOriginalEditor().mockLayout(420);
            await flushPromises();

            expect(sideLoading(element).style.left).toBe('0px');
            expect(sideLoading(element).style.width).toBe('420px');
        });

        it('waits over the whole pane inline', async () => {
            const element = await createDiffViewer({
                leftContent: 'kept',
                rightContent: 'kept'
            });
            const inline =
                element.shadowRoot.querySelector('.sfdl-diff-inline');
            inline.checked = true;
            inline.dispatchEvent(new CustomEvent('change'));

            element.loadingSide = 'left';
            await flushPromises();

            expect(sideLoading(element).style.left).toBe('0px');
            expect(sideLoading(element).style.right).toBe('0px');
        });

        it('says it is comparing, never that nothing differs', async () => {
            const element = await loadSide('right');

            diffEditor().mockDiffComputed([]);
            await flushPromises();

            expect(
                element.shadowRoot.querySelector('.sfdl-diff-count').textContent
            ).toBe('Comparing...');
            expect(
                element.shadowRoot.querySelector('.sfdl-diff-count_identical')
            ).toBeNull();
            expect(
                element.shadowRoot.querySelector('.sfdl-diff-next')
            ).toBeNull();
        });

        it('only says it is comparing, without its actions', async () => {
            const element = await loadSide('right');

            diffEditor().mockDiffComputed([
                {
                    originalStartLineNumber: 1,
                    originalEndLineNumber: 1,
                    modifiedStartLineNumber: 1,
                    modifiedEndLineNumber: 1
                }
            ]);
            await flushPromises();

            expect(
                element.shadowRoot.querySelector('.sfdl-diff-count').textContent
            ).toBe('Comparing...');
            [
                '.sfdl-diff-previous',
                '.sfdl-diff-next',
                '.sfdl-diff-inline',
                '.sfdl-diff-whitespace'
            ].forEach((selector) =>
                expect(element.shadowRoot.querySelector(selector)).toBeNull()
            );
        });

        it('brings its actions back once the side is in', async () => {
            const element = await loadSide('right');
            diffEditor().mockDiffComputed([
                {
                    originalStartLineNumber: 1,
                    originalEndLineNumber: 1,
                    modifiedStartLineNumber: 1,
                    modifiedEndLineNumber: 1
                }
            ]);
            await flushPromises();

            element.loadingSide = undefined;
            await flushPromises();

            expect(
                element.shadowRoot.querySelector('.sfdl-diff-next').disabled
            ).toBe(false);
            expect(
                element.shadowRoot.querySelector('.sfdl-diff-inline')
            ).not.toBeNull();
        });
    });
});
