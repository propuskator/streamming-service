import EventEmitter from 'events';

export default class Client extends EventEmitter  {
    constructor({ socket, key, adminUser }) {
        super();
        this.socket = socket;
        this.key = key;
        this.adminUser = adminUser;

        this.socket.on('close', (...args) => this.emit('close', ...args));
        this.socket.on('error', (...args) => this.emit('error', ...args));
        this.socket.on('message', (...args) => this.emit('message', ...args));
        this.socket.on('open', (...args) => this.emit('open', ...args));
    }

    terminate(...args) {
        this.socket.terminate(...args);
    }

    close(...args) {
        this.socket.close(...args);
    }

    send(...args) {
        this.socket.send(...args);
    }
}
