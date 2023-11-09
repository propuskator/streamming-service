import EventEmitter from 'events';

export default class ClientsGroup extends EventEmitter {
    constructor() {
        super();
        this.clients = {};
        this.artifacts = {};
    }

    get total() {
        return Object.keys(this.clients).length;
    }

    add(client) {
        if (this.clients[client.key]) throw new Error('client already added');

        const handlers = {
            'close' : () => {
                this.remove(client);
            },
            'error' : error => {
                this.emit('clientError', client, error);
            },
            'message' : message => {
                this.emit('clientMessage', client, message);
            }
        };

        for (const [ event, handler ] of Object.entries(handlers)) client.on(event, handler);

        this.clients[client.key] = client;
        this.artifacts[client.key] = { handlers };
        this.emit('total', this.total);
    }

    remove(client) {
        if (!this.clients[client.key]) throw new Error('client already added');

        const { handlers } = this.artifacts[client.key];

        for (const [ event, handler ] of Object.entries(handlers)) client.off(event, handler);

        delete this.clients[client.key];
        delete this.artifacts[client.key];
        this.emit('total', this.total);
    }

    broadcast(...args) {
        for (const client of Object.values(this.clients)) client.send(...args);
    }
}
