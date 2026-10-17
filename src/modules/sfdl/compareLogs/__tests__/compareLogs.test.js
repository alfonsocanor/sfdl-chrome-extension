import { createElement } from 'lwc';
import CompareLogs from 'sfdl/compareLogs';

const ACME = {
    instanceUrl: 'https://acme.my.salesforce.com',
    authToken: 'sid-acme',
    queryWhere: ''
};
const ORGS = [
    { label: 'https://acme.my.salesforce.com', value: 'sid-acme' },
    { label: 'https://globex.my.salesforce.com', value: 'sid-globex' }
];
const LOG_ONE = {
    id: '07L1',
    name: 'John Doe | ApexTesting',
    attributes: { url: '/services/data/v51.0/tooling/sobjects/ApexLog/07L1' }
};
const LOG_TWO = {
    id: '07L2',
    name: 'Jane Roe | Api',
    attributes: { url: '/services/data/v51.0/tooling/sobjects/ApexLog/07L2' }
};
const LOG_THREE = {
    id: '07L3',
    name: 'John Doe | Batch',
    attributes: { url: '/services/data/v51.0/tooling/sobjects/ApexLog/07L3' }
};

function wait(milliseconds = 0) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function mockOrg() {
    global.fetch = jest.fn(() =>
        Promise.resolve({
            status: 200,
            json: () => Promise.resolve({ done: true, records: [] }),
            text: () => Promise.resolve('')
        })
    );
    chrome.runtime.sendMessage.mockImplementation(() =>
        Promise.resolve({ apexLogList: [LOG_ONE, LOG_TWO, LOG_THREE] })
    );
}

async function createCompareLogs(properties = {}) {
    const element = createElement('sfdl-compare-logs', { is: CompareLogs });
    Object.assign(element, {
        orgs: ORGS,
        sessionInformation: ACME,
        height: 600,
        ...properties
    });
    document.body.appendChild(element);
    await wait();
    await wait();
    return element;
}

const pairList = (element) =>
    element.shadowRoot.querySelector('sfdl-compare-log-list');
const diffViewer = (element) =>
    element.shadowRoot.querySelector('sfdl-diff-viewer');
const modeButton = (element, mode) =>
    element.shadowRoot.querySelector(`[data-mode="${mode}"]`);

async function selectLog(list, log, side = null) {
    list.dispatchEvent(new CustomEvent('logselect', { detail: { log, side } }));
    await wait();
}

function selection(element) {
    const list = pairList(element);
    return [list.leftLogId, list.rightLogId];
}

describe('sfdl-compare-logs', () => {
    beforeEach(() => {
        mockOrg();
    });

    describe('modes', () => {
        it('opens comparing logs of the same org', async () => {
            const element = await createCompareLogs();

            expect(
                modeButton(element, 'sameOrg').classList.contains(
                    'slds-button_brand'
                )
            ).toBe(true);
            expect(
                modeButton(element, 'twoOrgs').classList.contains(
                    'slds-button_neutral'
                )
            ).toBe(true);
            expect(pairList(element).mode).toBe('pair');
            expect(pairList(element).sessionInformation).toEqual(ACME);
        });

        it('shows the org of the header on the panel of the logs', async () => {
            const element = await createCompareLogs();

            expect(
                element.shadowRoot.querySelector('sfdl-side-panel').subtitle
            ).toBe('acme.my.salesforce.com');
        });

        it('takes the height it is given', async () => {
            const element = await createCompareLogs({ height: 640 });

            expect(
                element.shadowRoot.querySelector('.sfdl-compare-logs').style
                    .height
            ).toBe('640px');
        });

        it('asks for an org in the header when there is none', async () => {
            const element = await createCompareLogs({
                sessionInformation: undefined
            });

            expect(diffViewer(element).emptyMessage).toBe(
                'Pick an org in Organization Instances above, then two of its logs.'
            );
        });
    });

    describe('picking logs in the same org', () => {
        it('fills the left side first and then the right one', async () => {
            const element = await createCompareLogs();

            await selectLog(pairList(element), LOG_ONE);
            expect(selection(element)).toEqual(['07L1', undefined]);
            expect(diffViewer(element).emptyMessage).toBe(
                'Now pick the log for the right side.'
            );

            await selectLog(pairList(element), LOG_TWO);
            expect(selection(element)).toEqual(['07L1', '07L2']);
            expect(diffViewer(element).leftLabel).toBe(LOG_ONE.name);
            expect(diffViewer(element).rightLabel).toBe(LOG_TWO.name);
        });

        it('replaces the right log once both sides are taken', async () => {
            const element = await createCompareLogs();

            await selectLog(pairList(element), LOG_ONE);
            await selectLog(pairList(element), LOG_TWO);
            await selectLog(pairList(element), LOG_THREE);

            expect(selection(element)).toEqual(['07L1', '07L3']);
        });

        it('takes a log off when it is clicked again', async () => {
            const element = await createCompareLogs();

            await selectLog(pairList(element), LOG_ONE);
            await selectLog(pairList(element), LOG_TWO);
            await selectLog(pairList(element), LOG_ONE);

            expect(selection(element)).toEqual([undefined, '07L2']);
            expect(diffViewer(element).emptyMessage).toBe(
                'Now pick the log for the left side.'
            );

            await selectLog(pairList(element), LOG_THREE);
            expect(selection(element)).toEqual(['07L3', '07L2']);
        });

        it('sends a log to the side of its pill and takes it off with a second click', async () => {
            const element = await createCompareLogs();

            await selectLog(pairList(element), LOG_TWO, 'right');
            expect(selection(element)).toEqual([undefined, '07L2']);

            await selectLog(pairList(element), LOG_ONE, 'right');
            expect(selection(element)).toEqual([undefined, '07L1']);

            await selectLog(pairList(element), LOG_ONE, 'right');
            expect(selection(element)).toEqual([undefined, undefined]);
        });

        it('can compare a log against itself through the pills', async () => {
            const element = await createCompareLogs();

            await selectLog(pairList(element), LOG_ONE, 'left');
            await selectLog(pairList(element), LOG_ONE, 'right');

            expect(selection(element)).toEqual(['07L1', '07L1']);

            await selectLog(pairList(element), LOG_ONE);
            expect(selection(element)).toEqual([undefined, undefined]);
        });

        it('forgets the logs of the previous org when the header org changes', async () => {
            const element = await createCompareLogs();
            await selectLog(pairList(element), LOG_ONE);

            element.sessionInformation = {
                instanceUrl: 'https://globex.my.salesforce.com',
                authToken: 'sid-globex'
            };
            await wait();

            expect(selection(element)).toEqual([undefined, undefined]);
        });

        it('keeps the logs when the header filter runs again on the same org', async () => {
            const element = await createCompareLogs();
            await selectLog(pairList(element), LOG_ONE);

            element.sessionInformation = {
                ...ACME,
                queryWhere: 'WHERE Id != null'
            };
            await wait();

            expect(selection(element)).toEqual(['07L1', undefined]);
        });

        it('starts over when the mode changes', async () => {
            const element = await createCompareLogs();
            await selectLog(pairList(element), LOG_ONE);

            modeButton(element, 'twoOrgs').click();
            await wait();
            modeButton(element, 'sameOrg').click();
            await wait();

            expect(selection(element)).toEqual([undefined, undefined]);
        });
    });
});
