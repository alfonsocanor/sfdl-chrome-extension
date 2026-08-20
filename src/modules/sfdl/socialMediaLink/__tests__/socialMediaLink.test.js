import { createElement } from 'lwc';
import SocialMediaLink from 'sfdl/socialMediaLink';

const LINKS = [
    {
        title: 'github repository',
        iconTitle: 'github logo',
        src: './resources/github.png',
        alt: 'github logo',
        url: 'https://github.com/alfonsocanor'
    }
];

function createSocialMediaLink(socialMediaList = LINKS) {
    const element = createElement('sfdl-social-media-link', {
        is: SocialMediaLink
    });
    element.socialMediaList = socialMediaList;
    document.body.appendChild(element);
    return element;
}

describe('sfdl-social-media-link', () => {
    it('renders a link per entry pointing to a new tab', () => {
        const element = createSocialMediaLink();

        const links = element.shadowRoot.querySelectorAll('a');
        expect(links.length).toBe(1);
        expect(links[0].href).toBe('https://github.com/alfonsocanor');
        expect(links[0].target).toBe('_blank');
    });

    it('renders the icon with its alternative text', () => {
        const element = createSocialMediaLink();

        const icon = element.shadowRoot.querySelector('img');
        expect(icon.getAttribute('src')).toBe('./resources/github.png');
        expect(icon.alt).toBe('github logo');
    });

    it('renders nothing when there is no link to show', () => {
        const element = createSocialMediaLink([]);

        expect(element.shadowRoot.querySelectorAll('a').length).toBe(0);
    });
});
