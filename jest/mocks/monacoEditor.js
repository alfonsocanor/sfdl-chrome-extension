// Minimal monaco-editor stand-in: the editor itself is not exercised by the unit tests.
function createCodeEditor() {
    return {
        revealLineInCenter: jest.fn(),
        setPosition: jest.fn(),
        focus: jest.fn()
    };
}

function createDiffEditor() {
    const diffListeners = [];
    const originalEditor = createCodeEditor();
    const modifiedEditor = createCodeEditor();
    let lineChanges = null;

    return {
        setModel: jest.fn(),
        updateOptions: jest.fn(),
        dispose: jest.fn(),
        getOriginalEditor: () => originalEditor,
        getModifiedEditor: () => modifiedEditor,
        getLineChanges: jest.fn(() => lineChanges),
        onDidUpdateDiff: jest.fn((listener) => {
            diffListeners.push(listener);
            return { dispose: jest.fn() };
        }),
        // Test helper: plays the diff computation finishing with these changes.
        mockDiffComputed(changes) {
            lineChanges = changes;
            diffListeners.forEach((listener) => listener());
        }
    };
}

module.exports = {
    editor: {
        defineTheme: jest.fn(),
        create: jest.fn(() => ({ dispose: jest.fn() })),
        createDiffEditor: jest.fn(createDiffEditor),
        createModel: jest.fn((value, language) => ({
            value,
            language,
            getValue: () => value,
            dispose: jest.fn()
        }))
    },
    languages: {
        register: jest.fn(),
        setMonarchTokensProvider: jest.fn(),
        getLanguages: jest.fn(() => [])
    }
};
