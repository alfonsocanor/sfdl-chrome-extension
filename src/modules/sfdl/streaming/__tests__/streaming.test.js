import { StreamingClient, STOPPED, CONNECTING, LISTENING, FAILED } from 'sfdl/streaming';
import { salesforceRequest } from 'sfdl/salesforceConnection';

jest.mock('sfdl/salesforceConnection', () =>
    Object.assign({}, jest.requireActual('sfdl/salesforceConnection'), {
        salesforceRequest: jest.fn()
    })
);

const ACME = { instanceUrl: 'https://acme.my.salesforce.com', authToken: 'sid-acme' };
const CHANNEL = '/event/Order_Event__e';
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const never = () => new Promise(() => {});

//An org that answers the handshake and the subscribe, then hands the connects
//their answers in turn, and never answers once they run out.
function org({ connects = [], handshake, subscribe } = {}) {
    const sent = [];
    salesforceRequest.mockImplementation((session, url, options) => {
        const [message] = JSON.parse(options.body);
        sent.push({ url, message, options });
        if (url.endsWith('/handshake')) {
            return Promise.resolve([handshake || { channel: '/meta/handshake', successful: true, clientId: 'c' + sent.length }]);
        }
        if (url.endsWith('/subscribe')) {
            return Promise.resolve([subscribe || { channel: '/meta/subscribe', successful: true, subscription: message.subscription }]);
        }
        if (url.endsWith('/connect')) {
            const next = connects.shift();
            return next ? next() : never();
        }
        return Promise.resolve([{ channel: '/meta/disconnect', successful: true }]);
    });
    return sent;
}

const event = (replayId, payload) => ({ channel: CHANNEL, data: { schema: 's', payload, event: { replayId, createdDate: '2026-10-28T10:00:00.000Z' } } });
const connected = (extra = {}) => ({ channel: '/meta/connect', successful: true, ...extra });

function client() {
    const events = [];
    const statuses = [];
    const instance = new StreamingClient(ACME, {
        apiVersion: '60.0',
        retryDelay: 0,
        onEvent: (received) => events.push(received),
        onStatus: (status) => statuses.push(status)
    });
    return { instance, events, statuses };
}

describe('streaming', () => {
    beforeEach(() => {
        salesforceRequest.mockReset();
    });

    it('shakes hands, subscribes from the newest events and hands over what each poll brings', async () => {
        const sent = org({ connects: [() => Promise.resolve([event(11, { Order__c: 'A' }), connected()])] });
        const { instance, events, statuses } = client();

        await instance.start(CHANNEL);
        await flush();

        expect(sent[0].url).toBe('https://acme.my.salesforce.com/cometd/60.0/handshake');
        expect(sent[0].message).toMatchObject({ channel: '/meta/handshake', version: '1.0', supportedConnectionTypes: ['long-polling'], ext: { replay: true } });
        expect(sent[0].options).toMatchObject({ method: 'POST', credentials: 'include' });
        expect(sent[1].message).toMatchObject({ channel: '/meta/subscribe', clientId: 'c1', subscription: CHANNEL, ext: { replay: { [CHANNEL]: -1 } } });
        expect(sent[2].message).toMatchObject({ channel: '/meta/connect', clientId: 'c1', connectionType: 'long-polling' });
        expect(statuses.map((status) => status.status)).toEqual([CONNECTING, LISTENING]);
        expect(events).toEqual([{
            channel: CHANNEL,
            replayId: 11,
            createdDate: '2026-10-28T10:00:00.000Z',
            payload: { Order__c: 'A' },
            raw: event(11, { Order__c: 'A' }).data
        }]);
        expect(instance.isRunning).toBe(true);
        expect(sent.filter((each) => each.url.endsWith('/connect')).length).toBe(2);
    });

    it('fails with what the org said when it refuses the channel', async () => {
        org({ subscribe: { channel: '/meta/subscribe', successful: false, error: '403::Unknown channel' } });
        const { instance, statuses } = client();

        await instance.start('/event/Nothing__e');

        expect(statuses[statuses.length - 1].status).toBe(FAILED);
        expect(statuses[statuses.length - 1].error.message).toBe('Unknown channel');
        expect(instance.isRunning).toBe(false);
    });

    it('fails when the handshake is denied', async () => {
        org({ handshake: { channel: '/meta/handshake', successful: false, error: '403::Handshake denied' } });
        const { instance, statuses } = client();

        await instance.start(CHANNEL);

        expect(statuses[statuses.length - 1]).toMatchObject({ status: FAILED });
        expect(statuses[statuses.length - 1].error.message).toBe('Handshake denied');
    });

    it('shakes hands again when the org forgot the client, and goes on from the last event seen', async () => {
        const sent = org({
            connects: [
                () => Promise.resolve([event(20, {}), connected()]),
                () => Promise.resolve([{ channel: '/meta/connect', successful: false, error: '403::Unknown client', advice: { reconnect: 'handshake' } }])
            ]
        });
        const { instance } = client();

        await instance.start(CHANNEL);
        await flush();
        await flush();

        const subscribes = sent.filter((each) => each.url.endsWith('/subscribe'));
        expect(sent.filter((each) => each.url.endsWith('/handshake')).length).toBe(2);
        expect(subscribes[1].message.ext.replay[CHANNEL]).toBe(20);
        expect(instance.isRunning).toBe(true);
    });

    it('stops when the org says not to come back, or the session is gone', async () => {
        org({ connects: [() => Promise.resolve([{ channel: '/meta/connect', successful: false, error: '402::Unknown client', advice: { reconnect: 'none' } }])] });
        const first = client();
        await first.instance.start(CHANNEL);
        await flush();
        expect(first.statuses[first.statuses.length - 1].status).toBe(FAILED);

        org({ connects: [() => Promise.reject(Object.assign(new Error('Invalid session'), { status: 401 }))] });
        const second = client();
        await second.instance.start(CHANNEL);
        await flush();
        expect(second.statuses[second.statuses.length - 1].error.message).toBe('Invalid session');
    });

    it('tries a dropped poll again', async () => {
        const sent = org({
            connects: [
                () => Promise.reject(new Error('Network down')),
                () => Promise.resolve([event(5, {}), connected()])
            ]
        });
        const { instance, events } = client();

        await instance.start(CHANNEL);
        await flush();
        await flush();

        expect(sent.filter((each) => each.url.endsWith('/connect')).length).toBe(3);
        expect(events.map((each) => each.replayId)).toEqual([5]);
    });

    it('stops listening and tells the org', async () => {
        const sent = org();
        const { instance, statuses } = client();
        await instance.start(CHANNEL);

        await instance.stop();

        expect(statuses[statuses.length - 1].status).toBe(STOPPED);
        expect(sent[sent.length - 1].message).toEqual({ channel: '/meta/disconnect', clientId: 'c1' });
        expect(instance.isRunning).toBe(false);
    });

    it('stops when the org says its daily deliveries are used up, instead of coming back', async () => {
        const sent = org({ connects: [() => Promise.resolve([{ channel: '/meta/connect', successful: false, error: '403::Organization total events daily limit exceeded', advice: { reconnect: 'handshake' } }])] });
        const { instance, statuses } = client();

        await instance.start(CHANNEL);
        await flush();

        expect(statuses[statuses.length - 1].status).toBe(FAILED);
        expect(statuses[statuses.length - 1].error.message).toBe('Organization total events daily limit exceeded');
        expect(sent.filter((each) => each.url.endsWith('/handshake')).length).toBe(1);
    });
});
