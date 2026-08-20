// Minimal monaco-editor stand-in: the editor itself is not exercised by the unit tests.
module.exports = {
    editor: {
        defineTheme: jest.fn(),
        create: jest.fn(() => ({ dispose: jest.fn() })),
        createDiffEditor: jest.fn(() => ({
            setModel: jest.fn(),
            dispose: jest.fn()
        }))
    },
    languages: {
        register: jest.fn(),
        setMonarchTokensProvider: jest.fn()
    }
};
