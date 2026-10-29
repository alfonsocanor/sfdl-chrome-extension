import { createElement } from 'lwc';
import LiveEvents, { MAX_EVENTS, durationLabel } from 'sfdl/liveEvents';
import { StreamingClient } from 'sfdl/streaming';
import { confirmDialog } from 'sfdl/utils';

jest.mock('sfdl/streaming', () => {
    const actual = jest.requireActual('sfdl/streaming');
    const instances = [];
    class FakeClient {
        constructor(session, options) {
            this.session = session;
            this.options = options;
            this.isRunning = false;
            this.start = jest.fn(() => {
                this.isRunning = true;
            });
            this.stop = jest.fn(() => {
                this.isRunning = false;
                options.onStatus({ status: 'stopped' });
            });
            instances.push(this);
        }
    }
    FakeClient.instances = instances;
    return Object.assign({}, actual, { StreamingClient: FakeClient });
});
jest.mock('sfdl/utils', () =>
    Object.assign({}, jest.requireActual('sfdl/utils'), {
        confirmDialog: jest.fn(() => Promise.resolve(true))
    })
);

const ACME = { instanceUrl: 'https://acme.my.salesforce.com', authToken: 'sid-acme' };
const COUNTED = { counted: true, used: 2000, max: 50000, remaining: 48000, percent: 4, maxEvents: 1000 };
const CHANNELS = [
    { id: '/event/LoginEventStream', name: 'LoginEventStream', label: 'Login Event Stream', kind: 'Real-time stream' },
    { id: '/event/Order_Event__e', name: 'Order_Event__e', label: 'Order Event', kind: 'Platform event' }
];

function monitor(budget = jest.fn(() => Promise.resolve(COUNTED))) {
    return {
        key: 'liveEvents',
        title: 'Live events',
        description: 'Listen.',
        emptyMessage: 'No channel.',
        listen: { minutes: [5, 15, 30, 60, 120], defaultMinutes: 30, maxEvents: 1000, alertPercent: 80, budget }
    };
}

function createLive({ channels = CHANNELS, budget } = {}) {
    const element = createElement('sfdl-live-events', { is: LiveEvents });
    element.monitor = monitor(budget);
    element.session = ACME;
    element.channels = channels;
    document.body.appendChild(element);
    return element;
}

const $ = (element, selector) => element.shadowRoot.querySelector(selector);
const text = (element, selector) => ($(element, selector) ? $(element, selector).textContent.trim() : null);
const click = (node) => node.dispatchEvent(new CustomEvent('click', { bubbles: true, composed: true }));
const lastClient = () => StreamingClient.instances[StreamingClient.instances.length - 1];
const settle = async () => {
    for (let tick = 0; tick < 6; tick++) {
        // eslint-disable-next-line no-await-in-loop
        await Promise.resolve();
    }
};

async function pick(element, selector, value) {
    $(element, selector).dispatchEvent(new CustomEvent('change', { detail: { value } }));
    await settle();
}

async function listenTo(element, channel = '/event/Order_Event__e') {
    await pick(element, '.sfdl-live-events__channel', channel);
    click($(element, '.sfdl-live-events__start'));
    await settle();
    const client = lastClient();
    client.options.onStatus({ status: 'listening' });
    await settle();
    return client;
}

describe('sfdl-live-events', () => {
    beforeEach(() => {
        StreamingClient.instances.length = 0;
        confirmDialog.mockClear();
        confirmDialog.mockImplementation(() => Promise.resolve(true));
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('names a duration in words', () => {
        expect(durationLabel(5)).toBe('5 minutes');
        expect(durationLabel(60)).toBe('1 hour');
        expect(durationLabel(120)).toBe('2 hours');
    });

    it('offers the channels under their kind, the times the monitor allows, and waits for a channel', async () => {
        const element = createLive();

        expect($(element, '.sfdl-live-events__channel').options).toEqual([
            { label: 'Login Event Stream (/event/LoginEventStream)', value: '/event/LoginEventStream', group: 'Real-time stream' },
            { label: 'Order Event (/event/Order_Event__e)', value: '/event/Order_Event__e', group: 'Platform event' }
        ]);
        expect($(element, '.sfdl-live-events__channel').searchable).toBe(true);
        expect($(element, '.sfdl-live-events__channel').noMatchMessage).toBe('No channel by that name');
        expect($(element, '.sfdl-live-events__duration').searchable).toBe(false);
        expect($(element, '.sfdl-live-events__duration').options.map((option) => option.label)).toEqual([
            '5 minutes', '15 minutes', '30 minutes', '1 hour', '2 hours'
        ]);
        expect($(element, '.sfdl-live-events__duration').value).toBe('30');
        expect($(element, '.sfdl-live-events__start').disabled).toBe(true);
        expect(text(element, '.sfdl-live-events__budget')).toMatch(/^Platform and change events heard here count toward/);

        await pick(element, '.sfdl-live-events__channel', '/event/Order_Event__e');
        expect($(element, '.sfdl-live-events__start').disabled).toBe(false);
    });

    it('reads what the org can spare, then listens until the time picked or the events it can spare', async () => {
        const budget = jest.fn(() => Promise.resolve({ ...COUNTED, maxEvents: 100 }));
        const element = createLive({ budget });

        const client = await listenTo(element);

        expect(budget).toHaveBeenCalledWith(ACME, CHANNELS[1]);
        expect(client.session).toEqual(ACME);
        expect(client.options.apiVersion).toBe('60.0');
        expect(client.start).toHaveBeenCalledWith('/event/Order_Event__e');
        expect(text(element, '.sfdl-live-events__status')).toMatch(
            /^Listening to \/event\/Order_Event__e since .+, 0 events heard\. Stops by itself at \d\d:\d\d or after 100 events\.$/
        );
        expect(text(element, '.sfdl-live-events__budget')).toBe(
            'Each event heard here counts toward the org\'s event deliveries: 2,000 of 50,000 used in the last 24 hours (4%).'
        );
        expect($(element, '.sfdl-live-events__start').disabled).toBe(true);
        expect($(element, '.sfdl-live-events__stop').disabled).toBe(false);
    });

    it('listens to a real-time stream for its time only, since it counts toward no delivery', async () => {
        const element = createLive({ budget: jest.fn(() => Promise.resolve({ counted: false, maxEvents: null })) });

        await listenTo(element, '/event/LoginEventStream');

        expect(text(element, '.sfdl-live-events__status')).toMatch(/Stops by itself at \d\d:\d\d\.$/);
        expect(text(element, '.sfdl-live-events__budget')).toBe('Real-time streams do not count toward the event deliveries of the org.');
    });

    it('stops by itself once the time picked is over, and says so', async () => {
        jest.useFakeTimers();
        const element = createLive();
        await pick(element, '.sfdl-live-events__duration', '5');

        const client = await listenTo(element);
        jest.advanceTimersByTime(5 * 60 * 1000 - 1);
        expect(client.stop).not.toHaveBeenCalled();

        jest.advanceTimersByTime(1);
        await settle();

        expect(client.stop).toHaveBeenCalledTimes(1);
        expect(text(element, '.sfdl-live-events__status')).toBe('Stopped by itself after 5 minutes, 0 events heard.');
        expect($(element, '.sfdl-live-events__start').disabled).toBe(false);
    });

    it('counts a time picked while listening from when listening started', async () => {
        jest.useFakeTimers('modern');
        const element = createLive();
        const client = await listenTo(element);

        jest.advanceTimersByTime(10 * 60 * 1000);
        await pick(element, '.sfdl-live-events__duration', '15');
        jest.advanceTimersByTime(5 * 60 * 1000 - 1);
        expect(client.stop).not.toHaveBeenCalled();

        jest.advanceTimersByTime(1);
        expect(client.stop).toHaveBeenCalledTimes(1);
    });

    it('stops by itself once it heard the events the org can spare', async () => {
        const element = createLive({ budget: jest.fn(() => Promise.resolve({ ...COUNTED, maxEvents: 2 })) });
        const client = await listenTo(element);

        client.options.onEvent({ channel: 'c', replayId: 1, payload: {}, raw: {} });
        expect(client.stop).not.toHaveBeenCalled();
        client.options.onEvent({ channel: 'c', replayId: 2, payload: {}, raw: {} });
        await settle();

        expect(client.stop).toHaveBeenCalledTimes(1);
        expect(text(element, '.sfdl-live-events__status')).toBe(
            'Stopped by itself after 2 events, to leave the rest of the org\'s daily event deliveries to its own subscribers.'
        );
    });

    it('does not start when the org has no deliveries to spare', async () => {
        const element = createLive({ budget: jest.fn(() => Promise.resolve({ ...COUNTED, used: 49995, remaining: 5, percent: 100, maxEvents: 0 })) });
        await pick(element, '.sfdl-live-events__channel', '/event/Order_Event__e');

        click($(element, '.sfdl-live-events__start'));
        await settle();

        expect(lastClient()).toBeUndefined();
        expect(confirmDialog).not.toHaveBeenCalled();
        expect(text(element, '.sfdl-live-events__status')).toBe(
            'Not started: the org has 5 event deliveries left in the last 24 hours, and its own subscribers need them.'
        );
        expect($(element, '.sfdl-live-events__status').classList).toContain('sfdl-live-events__status_failed');
    });

    it('asks first when most of the deliveries are used, and stays put on a no', async () => {
        confirmDialog.mockImplementation(() => Promise.resolve(false));
        const element = createLive({ budget: jest.fn(() => Promise.resolve({ ...COUNTED, used: 45000, remaining: 5000, percent: 90, maxEvents: 500 })) });
        await pick(element, '.sfdl-live-events__channel', '/event/Order_Event__e');

        click($(element, '.sfdl-live-events__start'));
        await settle();

        expect(confirmDialog).toHaveBeenCalledWith(expect.objectContaining({
            title: 'Listen with 90% of the deliveries used?',
            confirmLabel: 'Listen',
            variant: 'destructive'
        }));
        expect(lastClient()).toBeUndefined();
        expect($(element, '.sfdl-live-events__start').disabled).toBe(false);

        confirmDialog.mockImplementation(() => Promise.resolve(true));
        click($(element, '.sfdl-live-events__start'));
        await settle();
        expect(lastClient().start).toHaveBeenCalledWith('/event/Order_Event__e');
    });

    it('keeps the cap of the monitor when what the org can spare cannot be read', async () => {
        const element = createLive({ budget: jest.fn(() => Promise.reject(new Error('No access'))) });

        await listenTo(element);

        expect(text(element, '.sfdl-live-events__status')).toMatch(/or after 1,000 events\.$/);
    });

    it('does not start when stopped while it reads what the org can spare', async () => {
        let answer;
        const element = createLive({ budget: jest.fn(() => new Promise((resolve) => { answer = resolve; })) });
        await pick(element, '.sfdl-live-events__channel', '/event/Order_Event__e');
        click($(element, '.sfdl-live-events__start'));
        await settle();
        expect(text(element, '.sfdl-live-events__status')).toBe('Reading what the org can spare of its event deliveries…');

        click($(element, '.sfdl-live-events__stop'));
        answer(COUNTED);
        await settle();

        expect(lastClient()).toBeUndefined();
    });

    it('lists each event the newest first, its payload cut short with a more', async () => {
        const element = createLive();
        const client = await listenTo(element);

        client.options.onEvent({ channel: '/event/Order_Event__e', replayId: 1, createdDate: '2026-10-28T10:00:00.000Z', payload: { Order__c: 'A' }, raw: { id: 1 } });
        client.options.onEvent({ channel: '/event/Order_Event__e', replayId: 2, createdDate: '2026-10-28T10:01:00.000Z', payload: { Note__c: 'x'.repeat(200) }, raw: { id: 2 } });
        await settle();

        const rows = element.shadowRoot.querySelectorAll('tbody tr');
        expect(rows.length).toBe(2);
        expect(rows[0].querySelectorAll('td')[2].textContent).toBe('2');
        expect(rows[1].querySelector('.sfdl-live-events__payload-line').textContent).toBe('{"Order__c":"A"}');
        expect(rows[1].querySelector('.sfdl-live-events__more')).toBeNull();
        expect(text(element, '.sfdl-live-events__status')).toMatch(/2 events heard\./);

        click(rows[0].querySelector('.sfdl-live-events__more'));
        await settle();
        expect(element.shadowRoot.querySelector('tbody tr .sfdl-live-events__payload-text').textContent).toBe(JSON.stringify({ Note__c: 'x'.repeat(200) }, null, 2));
    });

    it('keeps the latest events only, copies them as the org sent them, and clears them', async () => {
        const writeText = jest.fn(() => Promise.resolve());
        Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
        const element = createLive({ budget: jest.fn(() => Promise.resolve({ counted: false, maxEvents: null })) });
        const client = await listenTo(element, '/event/LoginEventStream');
        for (let index = 0; index < MAX_EVENTS + 5; index++) {
            client.options.onEvent({ channel: 'c', replayId: index, payload: {}, raw: { index } });
        }
        await settle();
        expect(element.shadowRoot.querySelectorAll('tbody tr').length).toBe(MAX_EVENTS);
        expect(client.stop).not.toHaveBeenCalled();

        click($(element, '.sfdl-live-events__copy'));
        await settle();
        const copied = JSON.parse(writeText.mock.calls[0][0]);
        expect(copied.length).toBe(MAX_EVENTS);
        expect(copied[0]).toEqual({ index: MAX_EVENTS + 4 });

        click($(element, '.sfdl-live-events__clear'));
        await settle();
        expect(element.shadowRoot.querySelector('table')).toBeNull();
        delete navigator.clipboard;
    });

    it('says why it could not listen', async () => {
        const element = createLive();
        const client = await listenTo(element);

        client.options.onStatus({ status: 'failed', error: new Error('Unknown channel') });
        await settle();

        expect(text(element, '.sfdl-live-events__status')).toBe('Could not listen to /event/Order_Event__e: Unknown channel');
        expect($(element, '.sfdl-live-events__status').classList).toContain('sfdl-live-events__status_failed');
        expect($(element, '.sfdl-live-events__start').disabled).toBe(false);
    });

    it('moves to another channel picked while listening, stops on Stop and on the way out', async () => {
        const element = createLive();
        const client = await listenTo(element);

        await pick(element, '.sfdl-live-events__channel', '/event/LoginEventStream');
        expect(client.start).toHaveBeenLastCalledWith('/event/LoginEventStream');
        client.options.onStatus({ status: 'listening' });
        await settle();

        const stops = client.stop.mock.calls.length;
        click($(element, '.sfdl-live-events__stop'));
        expect(client.stop.mock.calls.length).toBe(stops + 1);
        await settle();
        expect(text(element, '.sfdl-live-events__status')).toBe('Pick a channel and start listening. Only what happens from then on is heard.');

        document.body.removeChild(element);
        expect(client.stop.mock.calls.length).toBe(stops + 2);
    });

    it('goes back, and says what the monitor says without channels', () => {
        const element = createLive({ channels: [] });
        const back = jest.fn();
        element.addEventListener('back', back);

        expect(text(element, '.sfdl-live-events__empty')).toBe('No channel.');
        expect($(element, 'sfdl-combobox')).toBeNull();
        click($(element, '.sfdl-live-events__back'));
        expect(back).toHaveBeenCalled();
    });
});
