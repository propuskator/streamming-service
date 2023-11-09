import EventEmitter from 'events';
import Promise from 'bluebird';
import express from 'express';
import expressWebSocket from 'express-ws';
import Client from './Client';
import { validateToken } from './admin/sessions/utils';


export default class WebSocketServer extends EventEmitter {
    constructor({ port = 9001, ip = '0.0.0.0', debug } = {}) {
        super();
        this.handleConnection = this.handleConnection.bind(this);

        this.sockets = {};

        this.initialized = false;
        this.initializing = false;
        this.destroying = false;
        this.server = null;
        this.debug = debug;
        this.config = { port, ip };
    }

    async start() {
        if (this.app) throw new Error('Server is already initialized');

        this.app = express();
        expressWebSocket(this.app);

        this.app.ws('/streamming-service/:id', this.handleConnection);

        await Promise.fromCallback(cb => {
            this.debug.info(`Listen on ws port ${this.config.port}`);
            this.server = this.app.listen(this.config.port, this.config.ip, cb);
        });
    }

    async stop() {
        if (!this.app) throw new Error('WebSocket erver is not initialized');
        await Promise.fromCallback(cb => {
            this.server.close(cb);
            for (const socket of Object.values(this.sockets)) socket.close();
        });
        this.app = null;
        this.server = null;
    }

    async handleConnection(socket, req) {
        const key = `${req.connection.remoteAddress}:${req.connection.remotePort}`;

        this.sockets[key] = socket;
        const onClose = () => {
            socket.off('close', onClose);
            socket.off('error', onError);
            delete this.sockets[key];
            this.debug.info(`Disconnected WebSocket ${key} (${  Object.keys(this.sockets).length  } total)`);
        };

        const onError = error => {
            this.emit('error', error);
        };

        socket.on('close', onClose);
        socket.on('error', onError);

        // authirize socket here

        const token = req.headers['sec-websocket-protocol'];

        this.debug.info(`Connected WebSocket ${key} (${  Object.keys(this.sockets).length  } total)`);
        let adminUser = null;

        try {
            const res = await validateToken(token);

            adminUser = res[1];
        } catch (e) {
            this.debug.warn(`Error: WebSocket ${key} with wrong token (${e.message})`);
            socket.close();

            return;
        }

        this.debug.info(`Autorized WebSocket ${key} (${  Object.keys(this.sockets).length  } total)`);

        // emit client
        this.emit('client', new Client({ socket, key, adminUser }), req);
    }
}
