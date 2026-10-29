import { createElement } from 'lwc';
import Monitoring from 'sfdl/monitoring';
import { MONITORS } from 'sfdl/monitors';
import { alertDialog, confirmDialog } from 'sfdl/utils';

jest.mock('sfdl/utils', () =>
    Object.assign({}, jest.requireActual('sfdl/utils'), {
        alertDialog: jest.fn(() => Promise.resolve(true)),
        confirmDialog: jest.fn(() => Promise.resolve(true))
    })
);

jest.mock('sfdl/monitors', () => {
    const actual = jest.requireActual('sfdl/monitors');
    const FAKE_MONITORS = [
            {
                key: 'meters',
                section: 'limits',
                title: 'Every limit',
                description: 'The limits.',
                emptyMessage: 'Nothing',
                columns: [],
                groupings: [],
                load: jest.fn(),
                summarize: ({ items }) => ({
                    value: items.length ? items[0].percent + '%' : '0%',
                    caption: items.length ? items[0].label : '',
                    severity: 'clear'
                })
            },
            {
                key: 'first',
                section: 'apex',
                title: 'First monitor',
                description: 'The first.',
                emptyMessage: 'Nothing',
                columns: [{ key: 'name', label: 'Name' }],
                groupings: [],
                load: jest.fn(),
                summarize: ({ items, total }) => ({
                    value: items.length,
                    caption: 'of ' + total,
                    severity: items.length ? 'alert' : 'clear'
                })
            },
            {
                key: 'second',
                section: 'flows',
                title: 'Second monitor',
                description: 'The second.',
                emptyMessage: 'Nothing',
                columns: [{ key: 'name', label: 'Name' }],
                groupings: [],
                load: jest.fn(),
                summarize: ({ items, total }) => ({
                    value: items.length,
                    caption: 'of ' + total,
                    severity: 'clear'
                })
            }
    ];
    return Object.assign({}, actual, {
        MONITORS: FAKE_MONITORS,
        getSections: () => actual.getSections(FAKE_MONITORS)
    });
});

const ORGS = [
    { label: 'https://acme.my.salesforce.com', value: 'sid-acme' },
    { label: 'https://globex.my.salesforce.com', value: 'sid-globex' }
];
const ACME_SESSION = { instanceUrl: ORGS[0].label, authToken: 'sid-acme' };
const GLOBEX_SESSION = { instanceUrl: ORGS[1].label, authToken: 'sid-globex' };
const [METERS_MONITOR, FIRST, SECOND] = MONITORS;

function wait() {
    return new Promise((resolve) => setTimeout(resolve, 0));
}

async function createMonitoring(properties = {}) {
    const element = createElement('sfdl-monitoring', { is: Monitoring });
    element.orgs = ORGS;
    Object.assign(element, properties);
    document.body.appendChild(element);
    await wait();
    await wait();
    return element;
}

const combobox = (element) => element.shadowRoot.querySelector('sfdl-combobox');
const cards = (element) => element.shadowRoot.querySelectorAll('sfdl-monitor-card');
const meters = (element) => element.shadowRoot.querySelectorAll('sfdl-monitor-meters');
const sectionTitles = (element) =>
    [...element.shadowRoot.querySelectorAll('.sfdl-monitoring__section-title')].map((node) => node.textContent);
const detail = (element) => element.shadowRoot.querySelector('sfdl-monitor-detail');
const refreshButton = (element) => element.shadowRoot.querySelector('.sfdl-monitoring__refresh');
const message = (element) => element.shadowRoot.querySelector('.sfdl-monitoring__message');

function pickOrg(element, url) {
    combobox(element).dispatchEvent(new CustomEvent('change', { detail: { value: url } }));
}

describe('sfdl-monitoring', () => {
    beforeEach(() => {
        METERS_MONITOR.load.mockImplementation(() =>
            Promise.resolve({ items: [{ id: 'DailyApiRequests', label: 'API requests today', used: 10, max: 100, percent: 10 }], total: 1 })
        );
        FIRST.load.mockImplementation(() => Promise.resolve({ items: [{ id: 'a', name: 'A' }], total: 4 }));
        SECOND.load.mockImplementation(() => Promise.resolve({ items: [], total: 0 }));
    });

    it('asks for an org before it shows anything, the step badge pulsing', async () => {
        const element = await createMonitoring();

        expect(message(element).textContent).toBe('Pick an org to see how it is doing.');
        expect(cards(element).length).toBe(0);
        expect(combobox(element).badge).toBe('1');
        expect(combobox(element).badgePulse).toBe(true);
        expect(refreshButton(element).disabled).toBe(true);
        expect(FIRST.load).not.toHaveBeenCalled();
    });

    it('offers every org with a session', async () => {
        const element = await createMonitoring();

        expect(combobox(element).options).toEqual([
            { label: ORGS[0].label, value: ORGS[0].label },
            { label: ORGS[1].label, value: ORGS[1].label }
        ]);
    });

    it('starts on the org of the log list and loads a card per monitor', async () => {
        const element = await createMonitoring({ sessionInformation: { ...ACME_SESSION, queryWhere: '' } });

        expect(combobox(element).value).toBe(ACME_SESSION.instanceUrl);
        expect(FIRST.load).toHaveBeenCalledWith(ACME_SESSION);
        expect(SECOND.load).toHaveBeenCalledWith(ACME_SESSION);
        expect(cards(element).length).toBe(2);
        expect(cards(element)[0].monitor.key).toBe('first');
        expect(cards(element)[0].state).toEqual({
            status: 'loaded',
            items: [{ id: 'a', name: 'A' }],
            total: 4,
            summary: { value: 1, caption: 'of 4', severity: 'alert', severityLabel: 'Needs a look' }
        });
        expect(cards(element)[1].state.summary.severityLabel).toBe('All clear');
        expect(message(element)).toBeNull();
        expect(refreshButton(element).disabled).toBe(false);
    });

    it('draws the sections of cards in order under their titles, and the limits as meters in a panel on the right', async () => {
        const element = await createMonitoring({ sessionInformation: ACME_SESSION });
        const sections = element.shadowRoot.querySelectorAll('.sfdl-monitoring__section');

        expect(sections.length).toBe(2);
        expect(sectionTitles(element)).toEqual(['Apex and jobs', 'Flows']);
        expect(sections[0].querySelector('sfdl-monitor-card').monitor.key).toBe('first');
        expect(sections[1].querySelector('sfdl-monitor-card').monitor.key).toBe('second');

        const panel = element.shadowRoot.querySelector('sfdl-side-panel.sfdl-monitoring__meters-panel');
        expect(panel.title).toBe('Limits at the moment');
        expect(panel.dock).toBe('right');
        expect(meters(element).length).toBe(1);
        expect(meters(element)[0].monitor.key).toBe('meters');
        expect(meters(element)[0].state.status).toBe('loaded');
        expect(meters(element)[0].state.items[0].label).toBe('API requests today');
        expect(METERS_MONITOR.load).toHaveBeenCalledWith(ACME_SESSION);
    });

    it('loads the org picked in the toolbar', async () => {
        const element = await createMonitoring();

        pickOrg(element, GLOBEX_SESSION.instanceUrl);
        await wait();
        await wait();

        expect(FIRST.load).toHaveBeenCalledWith(GLOBEX_SESSION);
        expect(combobox(element).value).toBe(GLOBEX_SESSION.instanceUrl);
        expect(combobox(element).badgePulse).toBe(false);
    });

    it('keeps the cards loading while the org answers and disables the refresh', async () => {
        FIRST.load.mockImplementation(() => new Promise(() => {}));
        const element = await createMonitoring({ sessionInformation: ACME_SESSION });

        expect(cards(element)[0].state).toEqual({ status: 'loading' });
        expect(cards(element)[1].state.status).toBe('loaded');
        expect(refreshButton(element).disabled).toBe(true);
    });

    it('a monitor that fails marks its card alone', async () => {
        FIRST.load.mockImplementation(() => Promise.reject(new Error('Invalid session')));
        const element = await createMonitoring({ sessionInformation: ACME_SESSION });

        expect(cards(element)[0].state).toEqual({ status: 'failed', error: 'Invalid session' });
        expect(cards(element)[1].state.status).toBe('loaded');
    });

    it('opens the detail of a card and comes back to the cards', async () => {
        const element = await createMonitoring({ sessionInformation: ACME_SESSION });

        cards(element)[0].dispatchEvent(new CustomEvent('open', { detail: { key: 'first' } }));
        await wait();

        expect(detail(element).monitor.key).toBe('first');
        expect(detail(element).items).toEqual([{ id: 'a', name: 'A' }]);
        expect(detail(element).summary.value).toBe(1);
        expect(element.shadowRoot.querySelector('.sfdl-monitoring__sections').classList).toContain('slds-hide');

        detail(element).dispatchEvent(new CustomEvent('back'));
        await wait();

        expect(detail(element)).toBeNull();
        expect(element.shadowRoot.querySelector('.sfdl-monitoring__sections').classList).not.toContain('slds-hide');
    });

    it('reads the org again from the refresh button', async () => {
        const element = await createMonitoring({ sessionInformation: ACME_SESSION });

        refreshButton(element).dispatchEvent(new CustomEvent('click', { bubbles: true, composed: true }));
        await wait();
        await wait();

        expect(FIRST.load).toHaveBeenCalledTimes(2);
        expect(SECOND.load).toHaveBeenCalledTimes(2);
    });

    it('drops the answers of an org left behind', async () => {
        let answerAcme;
        FIRST.load.mockImplementationOnce(
            () => new Promise((resolve) => { answerAcme = resolve; })
        );
        const element = await createMonitoring({ sessionInformation: ACME_SESSION });

        pickOrg(element, GLOBEX_SESSION.instanceUrl);
        await wait();
        await wait();
        answerAcme({ items: [{ id: 'old' }, { id: 'older' }], total: 9 });
        await wait();

        expect(cards(element)[0].state.items).toEqual([{ id: 'a', name: 'A' }]);
    });

    it('closes the detail when another org is picked', async () => {
        const element = await createMonitoring({ sessionInformation: ACME_SESSION });
        cards(element)[0].dispatchEvent(new CustomEvent('open', { detail: { key: 'first' } }));
        await wait();

        pickOrg(element, GLOBEX_SESSION.instanceUrl);
        await wait();

        expect(detail(element)).toBeNull();
    });

    it('takes the height it is given', async () => {
        const element = await createMonitoring({ height: 640 });

        expect(element.shadowRoot.querySelector('.sfdl-monitoring').getAttribute('style')).toBe('height:640px;');
    });

    describe('an org without what a monitor needs', () => {
        afterEach(() => {
            delete FIRST.requires;
        });

        it('tells what the monitor needs when the org does not know its object or refuses it', async () => {
            FIRST.requires = 'Comes with Shield.';
            FIRST.load.mockImplementation(() => Promise.reject(Object.assign(new Error("sObject type 'X' is not supported"), { errorCode: 'INVALID_TYPE' })));
            SECOND.load.mockImplementation(() => Promise.reject(Object.assign(new Error('No access'), { status: 403 })));

            const element = await createMonitoring({ sessionInformation: ACME_SESSION });

            expect(cards(element)[0].state).toEqual({ status: 'unavailable', error: 'Comes with Shield.' });
            expect(cards(element)[1].state).toEqual({ status: 'failed', error: 'No access' });
            expect(refreshButton(element).disabled).toBe(false);
        });

        it('is an error like any other when the monitor needs nothing in particular or the error is another', async () => {
            FIRST.requires = 'Comes with Shield.';
            FIRST.load.mockImplementation(() => Promise.reject(Object.assign(new Error('Bad field'), { errorCode: 'INVALID_FIELD' })));

            const element = await createMonitoring({ sessionInformation: ACME_SESSION });

            expect(cards(element)[0].state).toEqual({ status: 'failed', error: 'Bad field' });
        });
    });

    describe('the actions of a row', () => {
        let run;

        beforeEach(() => {
            run = jest.fn(() => Promise.resolve());
            FIRST.actions = [{ key: 'download', label: 'Download', run }];
            alertDialog.mockClear();
        });

        afterEach(() => {
            delete FIRST.actions;
        });

        async function openFirst() {
            const element = await createMonitoring({ sessionInformation: ACME_SESSION });
            cards(element)[0].dispatchEvent(new CustomEvent('open', { detail: { key: 'first' } }));
            await wait();
            return element;
        }

        it('runs the action of the open monitor on the item of its row with the org picked, busy until done', async () => {
            let finish;
            run.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
            const element = await openFirst();

            detail(element).dispatchEvent(new CustomEvent('action', { detail: { id: 'a', action: 'download' } }));
            await wait();

            expect(run).toHaveBeenCalledWith(ACME_SESSION, { id: 'a', name: 'A' });
            expect(detail(element).runningActions).toEqual(['a|download']);

            detail(element).dispatchEvent(new CustomEvent('action', { detail: { id: 'a', action: 'download' } }));
            expect(run).toHaveBeenCalledTimes(1);

            finish();
            await wait();
            expect(detail(element).runningActions).toEqual([]);
        });

        it('tells why an action failed', async () => {
            run.mockImplementation(() => Promise.reject(new Error('Gone')));
            const element = await openFirst();

            detail(element).dispatchEvent(new CustomEvent('action', { detail: { id: 'a', action: 'download' } }));
            await wait();

            expect(alertDialog).toHaveBeenCalledWith({ title: 'Could not download', message: 'Gone' });
            expect(detail(element).runningActions).toEqual([]);
        });

        it('does nothing for an action or a row it does not know', async () => {
            const element = await openFirst();

            detail(element).dispatchEvent(new CustomEvent('action', { detail: { id: 'zz', action: 'download' } }));
            detail(element).dispatchEvent(new CustomEvent('action', { detail: { id: 'a', action: 'erase' } }));
            await wait();

            expect(run).not.toHaveBeenCalled();
        });
    });

    describe('an action that changes the org', () => {
        let run;

        beforeEach(() => {
            run = jest.fn(() => Promise.resolve());
            FIRST.actions = [{
                key: 'disable',
                label: 'Disable',
                reloads: true,
                confirm: (item) => ({ title: 'Disable ' + item.name + '?', message: 'Sure?', confirmLabel: 'Disable', variant: 'destructive' }),
                run
            }];
            confirmDialog.mockClear();
        });

        afterEach(() => {
            delete FIRST.actions;
        });

        async function openFirst() {
            const element = await createMonitoring({ sessionInformation: ACME_SESSION });
            cards(element)[0].dispatchEvent(new CustomEvent('open', { detail: { key: 'first' } }));
            await wait();
            return element;
        }

        it('asks first and does nothing when the answer is no', async () => {
            confirmDialog.mockImplementation(() => Promise.resolve(false));
            const element = await openFirst();

            detail(element).dispatchEvent(new CustomEvent('action', { detail: { id: 'a', action: 'disable' } }));
            await wait();

            expect(confirmDialog).toHaveBeenCalledWith({ title: 'Disable A?', message: 'Sure?', confirmLabel: 'Disable', variant: 'destructive' });
            expect(run).not.toHaveBeenCalled();
        });

        it('runs on a yes and reads the monitor again, its detail left open', async () => {
            confirmDialog.mockImplementation(() => Promise.resolve(true));
            const element = await openFirst();
            FIRST.load.mockImplementation(() => Promise.resolve({ items: [{ id: 'a', name: 'A, disabled' }], total: 4 }));

            detail(element).dispatchEvent(new CustomEvent('action', { detail: { id: 'a', action: 'disable' } }));
            await wait();
            await wait();

            expect(run).toHaveBeenCalledWith(ACME_SESSION, { id: 'a', name: 'A' });
            expect(FIRST.load).toHaveBeenCalledTimes(2);
            expect(detail(element).items).toEqual([{ id: 'a', name: 'A, disabled' }]);
        });
    });

    describe('a monitor that listens', () => {
        afterEach(() => {
            delete FIRST.view;
        });

        it('opens on the live view with its channels and the org, not on the detail', async () => {
            FIRST.view = 'live';
            const element = await createMonitoring({ sessionInformation: ACME_SESSION });

            cards(element)[0].dispatchEvent(new CustomEvent('open', { detail: { key: 'first' } }));
            await wait();

            const live = element.shadowRoot.querySelector('sfdl-live-events');
            expect(detail(element)).toBeNull();
            expect(live.monitor.key).toBe('first');
            expect(live.channels).toEqual([{ id: 'a', name: 'A' }]);
            expect(live.session).toEqual(ACME_SESSION);

            live.dispatchEvent(new CustomEvent('back'));
            await wait();
            expect(element.shadowRoot.querySelector('sfdl-live-events')).toBeNull();
        });
    });
});
