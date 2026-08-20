// You only need this file
// - if you want to customize your Jest environment
// - if you want to use Jest i. e. from a Visual Studio Code extension
const { jestConfig } = require('lwc-services/lib/config/jestConfig');

module.exports = {
    ...jestConfig,
    transform: {
        '^.+\\.(js|ts|html|css)$': '<rootDir>/jest/lwcCoverageTransformer.js'
    },
    setupFilesAfterEnv: [
        ...(jestConfig.setupFilesAfterEnv || []),
        '<rootDir>/jest/setup.js'
    ],
    moduleNameMapper: {
        ...(jestConfig.moduleNameMapper || {}),
        '^monaco-editor$': '<rootDir>/jest/mocks/monacoEditor.js'
    },
    testPathIgnorePatterns: [
        '/node_modules/',
        '/dist/',
        '/src/slds/',
        '/src/monacowc/'
    ],
    collectCoverageFrom: [
        'src/**/*.js',
        '!src/slds/**',
        '!src/monacowc/**',
        '!src/prismjs/**',
        '!src/**/__tests__/**',
        '!src/**/*Css.js',
        '!src/modules/util/monacoThemes/**',
        // Dead module: it exports a name it never defines, so it cannot be parsed.
        '!src/modules/sfdl/salesforceConnection/**'
    ]
};
