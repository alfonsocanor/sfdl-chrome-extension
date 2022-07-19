import '@lwc/synthetic-shadow';
import { createElement } from 'lwc';
import SfdlLaunchStation from 'sfdl/launchStation';

const app = createElement('sfdl-launch-station', { is: SfdlLaunchStation });
// eslint-disable-next-line @lwc/lwc/no-document-query
document.querySelector('#sfdl-launch-station').appendChild(app);