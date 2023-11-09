import EventEmitter from 'events';
import _ from 'underscore';
import AccessCamera from '../models/AccessCamera';
import RtspStream from './streams/Rtsp';

export default class StreamService extends EventEmitter {
    constructor({ debug } = {}) {
        super();

        this.handleClient = this.handleClient.bind(this);

        this.streams = {};
        this.artifacts = {};
        this.debug = debug;

        this.initialized = false;
        this.initializing = false;
        this.destroying = false;
    }

    async init() {
        if (this.destroying) throw new Error('Cannot init while destroy');
        if (this.initializing || this.initialized) return;
        this.debug.info('Initializing');
        this.initializing = true;
        this.emit('initializing');

        // good staff here

        this.initializing = false;
        this.initialized = true;
        this.emit('initialized');
        this.debug.info('Initialized');
    }

    async destroy() {
        if (this.initializing) throw new Error('Cannot destroy while init');
        if (this.destroying || !this.initialized) return;
        this.destroying = true;

        // good staff here

        this.destroying = false;
    }

    createStreamForCamera({ key, streamUrl }) {
        if (this.streams[key]) throw new Error(`stream with key ${key} is already added`);
        this.debug.info(`createStreamForCamera ${key} ${streamUrl}`);
        const stream = this.streams[key] = new RtspStream({
            key, streamUrl, debug : this.debug
        });

        const handlers = {
            close : () => {
                this.removeStreamForCameraByKey(key);
            },
            error : () => {
                this.emit('error');
            }
        };

        for (const [ event, handler ] of Object.entries(handlers)) stream.on(event, handler);

        this.artifacts[key] = { handlers };
        stream.init();

        return stream;
    }

    removeStreamForCameraByKey(key) {
        if (!this.streams[key]) throw new Error(`stream with key ${key} does not exist`);
        const stream = this.streams[key];

        this.debug.info(`removeStreamForCameraByKey ${stream.key} ${stream.streamUrl}`);
        const { handlers } = this.artifacts[key];

        for (const [ event, handler ] of Object.entries(handlers)) stream.off(event, handler);

        if (stream.initialized) stream.close();

        delete this.streams[key];
        delete this.artifacts[key];
    }

    async handleClient(client, { params : { id : accessStreamId } }) {
        try {
            const accessCamera = await AccessCamera.findOne({
                where : {
                    id          : accessStreamId,
                    workspaceId : client.adminUser.workspaceId,
                    enabled     : true,
                    isArchived  : false
                }
            });

            if (!accessCamera) throw new Error(`Cannot find Camera with id ${accessStreamId}`);

            const key = accessCamera.id;
            const data = {
                key,
                streamUrl : accessCamera.rtspUrl
            };

            let stream = this.streams[key];

            if (stream) {
                // check if something changed
                // and if so
                if (_.any(Object.keys(data), k => stream[k] !== data[k])) {
                    this.removeStreamForCameraByKey(key);
                    stream = null;
                }
            }

            if (!stream) {
                stream = this.streams[accessCamera.id] = this.createStreamForCamera(data);
            }

            stream.addClient(client);
        } catch (e) {
            console.error(e);
            this.debug.error(e);
            client.close();
        }
    }
}
