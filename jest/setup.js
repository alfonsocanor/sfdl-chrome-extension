/**
 * Global test setup shared by every suite.
 * - Provides the `chrome` extension APIs the components talk to.
 * - Polyfills the constructable stylesheets API used to inject the custom css.
 */

class CSSStyleSheetMock {
    constructor() {
        this.cssText = '';
    }

    replaceSync(cssText) {
        this.cssText = cssText;
    }
}

function createChromeMock() {
    return {
        runtime: {
            sendMessage: jest.fn(() => Promise.resolve({})),
            onMessage: { addListener: jest.fn() }
        },
        cookies: {
            getAll: jest.fn(() => Promise.resolve([]))
        },
        storage: {
            local: {
                set: jest.fn(),
                get: jest.fn(() => Promise.resolve({})),
                clear: jest.fn()
            }
        },
        tabs: {
            create: jest.fn(),
            onRemoved: { addListener: jest.fn() }
        }
    };
}

global.CSSStyleSheet = CSSStyleSheetMock;
global.createChromeMock = createChromeMock;

beforeEach(() => {
    global.chrome = createChromeMock();
    document.adoptedStyleSheets = [];
});

afterEach(() => {
    while (document.body.firstChild) {
        document.body.removeChild(document.body.firstChild);
    }
    jest.clearAllMocks();
});
