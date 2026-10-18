import { createElement } from 'lwc';
import Skeleton from 'sfdl/skeleton';

function createSkeleton(properties = {}) {
    const element = createElement('sfdl-skeleton', { is: Skeleton });
    Object.assign(element, properties);
    document.body.appendChild(element);
    return element;
}

const items = (element) => [...element.shadowRoot.querySelectorAll('li')];
const bonesOf = (item) => [
    ...item.querySelector('.sfdl-skeleton__row').children
];

describe('sfdl-skeleton', () => {
    it('says it is loading, the outline itself hidden from screen readers', () => {
        const element = createSkeleton({ label: 'Loading the logs' });
        const status = element.shadowRoot.querySelector('.sfdl-skeleton');

        expect(status.getAttribute('role')).toBe('status');
        expect(status.getAttribute('aria-busy')).toBe('true');
        expect(status.getAttribute('aria-label')).toBe('Loading the logs');
        expect(
            element.shadowRoot.querySelector('ul').getAttribute('aria-hidden')
        ).toBe('true');
    });

    it('draws as many rows as it is asked, two lines of text by default', () => {
        const element = createSkeleton({ rows: '3' });

        expect(items(element)).toHaveLength(3);
        expect(
            items(element)[0].querySelectorAll('.sfdl-skeleton__line')
        ).toHaveLength(2);
    });

    it('draws each row in the shape it is handed, left to right', () => {
        const element = createSkeleton({
            rows: 1,
            shape: [{ square: 14 }, { lines: 2 }, { square: 18 }]
        });
        const bones = bonesOf(items(element)[0]);

        expect(bones.map((bone) => bone.className)).toEqual([
            'sfdl-skeleton__bone sfdl-skeleton__square',
            'sfdl-skeleton__text',
            'sfdl-skeleton__bone sfdl-skeleton__square'
        ]);
        expect(bones[0].style.width).toBe('14px');
        expect(bones[0].style.height).toBe('14px');
        expect(bones[2].style.width).toBe('18px');
        expect(
            bones[1].querySelectorAll('.sfdl-skeleton__line')
        ).toHaveLength(2);
    });

    it('takes the classes of the list it stands for', () => {
        const element = createSkeleton({
            rows: 1,
            listClass: 'slds-has-dividers_around',
            itemClass: 'slds-item',
            rowClass: 'sfdl-log-row'
        });

        expect(element.shadowRoot.querySelector('ul').className).toBe(
            'slds-has-dividers_around'
        );
        expect(items(element)[0].className).toBe('slds-item');
        expect(
            items(element)[0].querySelector('.sfdl-skeleton__row').className
        ).toBe('sfdl-skeleton__row sfdl-log-row');
    });

    it('varies the lines from one row to the next', () => {
        const element = createSkeleton({ rows: 2 });
        const firstLineWidth = (item) =>
            item.querySelector('.sfdl-skeleton__line').style.width;

        expect(firstLineWidth(items(element)[0])).not.toBe(
            firstLineWidth(items(element)[1])
        );
    });
});
