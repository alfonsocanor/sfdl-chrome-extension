import { createElement } from 'lwc';
import Footer from 'sfdl/footer';

function createFooter() {
    const element = createElement('sfdl-footer', { is: Footer });
    document.body.appendChild(element);
    return element;
}

describe('sfdl-footer', () => {
    it('links back to the sfdl page', () => {
        const element = createFooter();

        const { socialMediaList } = element.shadowRoot.querySelector(
            'sfdl-social-media-link'
        );
        expect(socialMediaList).toEqual([
            expect.objectContaining({
                url: 'https://salesforce.omltt.net/sfdl'
            })
        ]);
    });

    it('shows the social media block', () => {
        const element = createFooter();

        expect(
            element.shadowRoot.querySelector('sfdl-social-media')
        ).not.toBeNull();
    });
});
