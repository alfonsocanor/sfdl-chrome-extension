import { createElement } from 'lwc';
import SocialMedia from 'sfdl/socialMedia';

function createSocialMedia() {
    const element = createElement('sfdl-social-media', { is: SocialMedia });
    document.body.appendChild(element);
    return element;
}

describe('sfdl-social-media', () => {
    it('hands the github and vscode links over to the link renderer', () => {
        const element = createSocialMedia();

        const { socialMediaList } = element.shadowRoot.querySelector(
            'sfdl-social-media-link'
        );
        expect(socialMediaList.map((link) => link.url)).toEqual([
            'https://github.com/alfonsocanor',
            'https://marketplace.visualstudio.com/items?itemName=sfdl.sfdl'
        ]);
    });
});
