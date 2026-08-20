import { createElement } from 'lwc';
import ProcessBar from 'sfdl/processBar';

function createProcessBar(total = 10) {
    const element = createElement('sfdl-process-bar', { is: ProcessBar });
    element.total = total;
    element.placeholder = 'Downloading logs...';
    document.body.appendChild(element);
    return element;
}

const bar = (element) =>
    element.shadowRoot.querySelector('.slds-progress-bar__value');
const counter = (element) =>
    element.shadowRoot.querySelector('div').textContent.trim();

describe('sfdl-process-bar', () => {
    it('starts empty', () => {
        const element = createProcessBar();

        expect(bar(element).style.width).toBe('0%');
        expect(counter(element)).toBe('0 / 10');
    });

    it('exposes the placeholder as the accessible label', () => {
        const element = createProcessBar();

        expect(
            element.shadowRoot
                .querySelector('.slds-progress-bar')
                .getAttribute('aria-label')
        ).toBe('Downloading logs...');
    });

    it('grows as the progress is reported', () => {
        const element = createProcessBar(4);

        element.updateProgressBar(1);
        return Promise.resolve()
            .then(() => {
                expect(bar(element).style.width).toBe('25%');
                expect(counter(element)).toBe('1 / 4');
                element.updateProgressBar(4);
            })
            .then(() => {
                expect(bar(element).style.width).toBe('100%');
                expect(counter(element)).toBe('4 / 4');
            });
    });

    it('reports a full bar for a single log download', () => {
        const element = createProcessBar(1);

        element.updateProgressBar(1);

        return Promise.resolve().then(() => {
            expect(bar(element).style.width).toBe('100%');
        });
    });
});
