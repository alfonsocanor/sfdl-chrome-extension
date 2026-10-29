import { salesforceRequest, SalesforceError } from 'sfdl/salesforceConnection';

//The Streaming API of an org, its CometD endpoint spoken by hand: a handshake
//names the client, a subscribe picks the channel, then one long poll after
//another hands the events over as they come. The org keeps the client on a
//cookie, so every call carries the cookies of the org.
const META = {
    handshake: '/meta/handshake',
    subscribe: '/meta/subscribe',
    connect: '/meta/connect',
    disconnect: '/meta/disconnect'
};
//The newest events only, none of the ones kept before the subscribe.
export const NEW_EVENTS = -1;
//How long to wait before asking again after a poll failed, so a dropped
//connection is not hammered.
const RETRY_DELAY = 2000;

export const STOPPED = 'stopped';
export const CONNECTING = 'connecting';
export const LISTENING = 'listening';
export const FAILED = 'failed';

function wait(milliseconds){
    return new Promise(resolve => setTimeout(resolve, milliseconds));
}

//A message of the server that says no, as an error: '403::Unknown channel'
//reads 'Unknown channel'.
function refusal(message, what){
    const text = String(message.error || '').replace(/^\d+::/, '') || what + ' was refused';
    const error = new SalesforceError(text, 0, message.error);
    error.refused = true;
    return error;
}

export class StreamingClient{
    //onEvent({ channel, replayId, createdDate, payload, raw }) for each event,
    //onStatus({ status, error }) when the client starts, listens, stops or
    //fails.
    constructor(session, { apiVersion, onEvent = () => {}, onStatus = () => {}, retryDelay = RETRY_DELAY } = {}){
        this.session = session;
        this.url = session.instanceUrl + '/cometd/' + apiVersion;
        this.onEvent = onEvent;
        this.onStatus = onStatus;
        this.retryDelay = retryDelay;
        this.status = STOPPED;
        this.clientId = undefined;
        this.channel = undefined;
        this.replayId = NEW_EVENTS;
        this.controller = undefined;
        this.messageId = 0;
    }

    setStatus(status, error){
        this.status = status;
        this.onStatus({ status, error });
    }

    get isRunning(){
        return this.status === CONNECTING || this.status === LISTENING;
    }

    //The server answers a list of messages: the reply to the one sent, on
    //its channel, and on a connect the events that came meanwhile.
    async send(type, message){
        const answer = await salesforceRequest(this.session, this.url + '/' + type, {
            method: 'POST',
            credentials: 'include',
            signal: this.controller && this.controller.signal,
            body: JSON.stringify([{ id: String(++this.messageId), ...message }])
        });
        const messages = Array.isArray(answer) ? answer.filter(Boolean) : [];
        return { reply: messages.find(candidate => candidate.channel === message.channel), messages };
    }

    async handshake(){
        const { reply } = await this.send('handshake', {
            channel: META.handshake,
            version: '1.0',
            minimumVersion: '1.0',
            supportedConnectionTypes: ['long-polling'],
            ext: { replay: true }
        });

        if(!reply || !reply.successful){
            throw refusal(reply || {}, 'The handshake');
        }
        this.clientId = reply.clientId;
    }

    async subscribe(){
        const { reply } = await this.send('subscribe', {
            channel: META.subscribe,
            clientId: this.clientId,
            subscription: this.channel,
            ext: { replay: { [this.channel]: this.replayId } }
        });

        if(!reply || !reply.successful){
            throw refusal(reply || {}, 'The subscription to ' + this.channel);
        }
    }

    //Listens to the channel from now on, until stop.
    async start(channel){
        if(this.isRunning){
            await this.stop();
        }

        this.channel = channel;
        this.replayId = NEW_EVENTS;
        this.controller = new AbortController();
        this.setStatus(CONNECTING);

        try{
            await this.handshake();
            await this.subscribe();
        } catch(error){
            this.fail(error);
            return;
        }

        this.setStatus(LISTENING);
        this.poll();
    }

    fail(error){
        if(error && error.name === 'AbortError'){
            return;
        }
        this.controller = undefined;
        this.setStatus(FAILED, error);
    }

    //One long poll after the other, while listening. The server answers a
    //poll as soon as it has events, or after a while without any.
    async poll(){
        while(this.status === LISTENING){
            try{
                // eslint-disable-next-line no-await-in-loop
                const { messages } = await this.send('connect', {
                    channel: META.connect,
                    clientId: this.clientId,
                    connectionType: 'long-polling'
                });
                // eslint-disable-next-line no-await-in-loop
                await this.receive(messages);
            } catch(error){
                if(error.name === 'AbortError' || this.status !== LISTENING){
                    return;
                }
                //A session gone or a server that says not to come back ends it,
                //anything else is tried again.
                if(error.status === 401 || error.refused){
                    this.fail(error);
                    return;
                }
                // eslint-disable-next-line no-await-in-loop
                await wait(this.retryDelay);
            }
        }
    }

    //The events of a poll go out one by one. A connect the server refused
    //with an advice to handshake again is a client it forgot: a new one
    //listens from the last event seen.
    async receive(messages){
        let rehandshake = false;

        messages.forEach(message => {
            if(message.channel === META.connect){
                const advice = message.advice || {};
                //A limit of the org reached, its daily deliveries or its
                //clients, is no reason to come back at once either.
                if(!message.successful && (advice.reconnect === 'none' || /limit/i.test(message.error || ''))){
                    throw refusal(message, 'The connection');
                }
                rehandshake = !message.successful && advice.reconnect === 'handshake';
            } else if(message.data){
                const event = message.data.event || {};
                if(typeof event.replayId === 'number'){
                    this.replayId = event.replayId;
                }
                this.onEvent({
                    channel: message.channel,
                    replayId: event.replayId,
                    createdDate: event.createdDate,
                    payload: message.data.payload || message.data.sobject || message.data,
                    raw: message.data
                });
            }
        });

        if(rehandshake){
            await this.handshake();
            await this.subscribe();
        }
    }

    //Stops listening and lets the server know, without waiting on it.
    async stop(){
        const clientId = this.clientId;
        const wasRunning = this.isRunning;

        if(this.controller){
            this.controller.abort();
        }
        this.controller = undefined;
        this.clientId = undefined;
        this.setStatus(STOPPED);

        if(wasRunning && clientId){
            try{
                await salesforceRequest(this.session, this.url + '/disconnect', {
                    method: 'POST',
                    credentials: 'include',
                    body: JSON.stringify([{ channel: META.disconnect, clientId }])
                });
            } catch(error){
                //The client is gone either way.
            }
        }
    }
}
