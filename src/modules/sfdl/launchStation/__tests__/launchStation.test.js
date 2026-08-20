import { createElement } from 'lwc';
import LaunchStation from 'sfdl/launchStation';

function createLaunchStation(pathname) {
    delete window.location;
    window.location = { pathname };

    // sfdl-console boots itself from the org cookies; leaving that lookup pending
    // keeps this suite focused on the launch station itself.
    chrome.cookies.getAll.mockImplementation(() => new Promise(() => {}));

    const element = createElement('sfdl-launch-station', { is: LaunchStation });
    document.body.appendChild(element);
    return element;
}

function click(node) {
    node.dispatchEvent(
        new CustomEvent('click', { bubbles: true, composed: true })
    );
}

describe('sfdl-launch-station', () => {
    describe('as the browser action popup', () => {
        it('offers a button to launch the console instead of the console itself', () => {
            const element = createLaunchStation('/popup.html');

            expect(element.shadowRoot.querySelector('sfdl-console')).toBeNull();
            expect(
                element.shadowRoot.querySelector('button').textContent
            ).toContain('Launch sfdl Console Station');
        });

        it('opens the console in a new tab', () => {
            const element = createLaunchStation('/popup.html');

            click(element.shadowRoot.querySelector('button'));

            expect(chrome.tabs.create).toHaveBeenCalledWith({
                url: 'sfdl.html'
            });
        });
    });

    describe('as the console page', () => {
        it('renders the console behind the splash logo', () => {
            const element = createLaunchStation('/sfdl.html');

            expect(
                element.shadowRoot.querySelector('sfdl-console')
            ).not.toBeNull();
            expect(
                element.shadowRoot.querySelector('.sfdl-logo')
            ).not.toBeNull();
        });

        it('fades the splash logo out and removes it', () => {
            jest.useFakeTimers();
            try {
                const element = createLaunchStation('/sfdl.html');

                jest.advanceTimersByTime(50);
                expect(
                    element.shadowRoot
                        .querySelector('.sfdl-logo')
                        .classList.contains('fade-out')
                ).toBe(true);

                jest.advanceTimersByTime(1000);
                expect(
                    element.shadowRoot.querySelector('.sfdl-logo')
                ).toBeNull();
            } finally {
                jest.useRealTimers();
            }
        });
    });
});
