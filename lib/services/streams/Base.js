import EventEmitter from 'events';
import ClientsGroup from '../ClientsGroup';

export default class StreamBase extends EventEmitter {
    constructor() {
        super();
        this.group = new ClientsGroup();
    }

    addClient(client) {
        this.group.add(client);
    }

    removeClient(client) {
        this.group.remove(client);
    }
}
