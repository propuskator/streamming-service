import dns from 'dns';
import Mpeg1Muxer from '../../modules/node-rtsp-stream/mpeg1muxer';
import StreamBase from './Base';

const STREAM_MAGIC_BYTES = 'jsmp';

function buildHelloMessage(width, height) {
    const streamHeader = Buffer.alloc(8);

    streamHeader.write(STREAM_MAGIC_BYTES);
    streamHeader.writeUInt16BE(width, 4);
    streamHeader.writeUInt16BE(height, 6);

    return streamHeader;
}

export default class RstpStream extends StreamBase {
    constructor({ key, streamUrl, width = null, height = null, ffmpegOptions = { '-stats': '', '-r': 30, '-ar': 48000 }, retryInterval = 5000, autoCloseInterval = 60000, debug }) {
        super();

        this.customWidth = width;
        this.customHeight = height;

        this.debug = debug;

        this.handleMpeg1data = this.handleMpeg1data.bind(this);
        this.handleFfmpegStderr = this.handleFfmpegStderr.bind(this);
        this.handleExit = this.handleExit.bind(this);

        this.key = key;
        this.streamUrl = streamUrl;
        this.ffmpegOptions = ffmpegOptions;

        this.retryInterval = retryInterval;
        this.retryTimeout = null;

        this.autoCloseInterval = autoCloseInterval;
        this.autoCloseTimeout = null;
        this.group.on('total', total => {
            clearTimeout(this.autoCloseTimeout);
            if (this.autoCloseInterval === null || !this.initialized) return;
            if (total === 0) {
                this.debug.info(`Stream ${this.key}|${this.streamUrl} has 0 client and will be destrouyed after ${this.autoCloseInterval}ms`);
                this.autoCloseTimeout = setTimeout(this.close.bind(this), this.autoCloseInterval);
            }
        });

        this.mpeg1Muxer = null;
        this.gettingInputData = false;
        this.gettingOutputData = false;
        this.inputData = [];
        this.width = this.customWidth;
        this.height = this.customHeight;

        if (this.width && this.height) {
            this.helloMessage = buildHelloMessage(this.width, this.height);
        }

        this.starting = false;
    }

    startStream() {
        clearTimeout(this.retryTimeout);
        if (this.starting || this.mpeg1Muxer) throw new Error('mpeg1Muxer already configured');

        this.starting = true;
        const streamUrl = new URL(this.streamUrl);

        dns.lookup(streamUrl.hostname, (err, ip) => {
            if (!this.starting) return;
            this.starting = false;
            if (err) {
                this.debug.error(err);
                if (this.initialized) this.retryTimeout = setTimeout(this.startStream.bind(this), this.retryInterval);
            } else {
                this.debug.info(`Resolved ${streamUrl.hostname} to ${ip}`);
                streamUrl.hostname = ip;
                this.mpeg1Muxer = new Mpeg1Muxer({
                    ffmpegOptions : this.ffmpegOptions,
                    url           : streamUrl.href,
                    ffmpegPath    : 'ffmpeg'
                });
                this.mpeg1Muxer.on('mpeg1data', this.handleMpeg1data);
                this.mpeg1Muxer.on('ffmpegStderr', this.handleFfmpegStderr);
                this.mpeg1Muxer.stream.on('exit', this.handleExit);
            }
        });
    }

    stopStream() {
        this.starting = false;

        if (!this.mpeg1Muxer) return; // if the stream has already been cleaned up by stream 'exit' event

        this.mpeg1Muxer.stream.kill();
        this.cleanupStream();
    }

    cleanupStream() {
        this.mpeg1Muxer.off('mpeg1data', this.handleMpeg1data);
        this.mpeg1Muxer.off('ffmpegStderr', this.handleFfmpegStderr);
        this.mpeg1Muxer.stream.off('exit', this.handleExit);
        this.mpeg1Muxer = null;
        this.gettingInputData = false;
        this.gettingOutputData = false;
        this.inputData = [];
        this.width = this.customWidth;
        this.height = this.customHeight;
        if (this.width && this.height) {
            this.helloMessage = buildHelloMessage(this.width, this.height);
        }
    }

    init() {
        this.initialized = true;
        this.startStream();
        if (this.autoCloseInterval !== null && this.group.total === 0) {
            this.autoCloseTimeout = setTimeout(this.close.bind(this), this.autoCloseInterval);
        }
    }

    addClient(client) {
        super.addClient(client);
        if (this.helloMessage) client.send(this.helloMessage, { binary: true });
    }

    removeClient(client) {
        super.removeClient(client);
    }

    close() {
        this.initialized = false;
        this.debug.info(`Stream ${this.key}|${this.streamUrl} closed`);
        // say bye to all clients
        for (const client of Object.values(this.group.clients)) client.close();
        this.stopStream();
        clearTimeout(this.autoCloseTimeout);
        clearTimeout(this.retryTimeout);
        this.emit('close');
    }

    // handlers

    handleMpeg1data(data) {
        try {
            this.group.broadcast(data);
            this.emit('camdata', data);
        } catch (e) {
            this.debug.warn(`error while handling rtsp stream data - ${e.message}`);
        }
    }

    handleFfmpegStderr(data) {
        try {
            // eslint-disable-next-line no-param-reassign
            data = data.toString();
            // console.log('handleFfmpegStderr', data);
            if (data.indexOf('Input #') !== -1) {
                this.gettingInputData = true;
            }

            if (data.indexOf('Output #') !== -1) {
                this.gettingInputData = false;
                this.gettingOutputData = true;
            }

            if (data.indexOf('frame') === 0) {
                this.gettingOutputData = false;
            }

            if (this.gettingInputData) {
                this.inputData.push(data.toString());
                let size = data.match(/\d+x\d+/);

                if (size !== null) {
                    size = size[0].split('x');
                    if (this.width === null) {
                        this.width = parseInt(size[0], 10);
                    }

                    if (this.height === null) {
                        this.height = parseInt(size[1], 10);
                    }

                    if (this.width && this.height) {
                        this.group.broadcast(this.helloMessage = buildHelloMessage(this.width, this.height));
                    }
                }
            }
        } catch (e) {
            this.debug.warn(`error while handling rtsp stream error - ${e.message}`);
        }
    }

    handleExit(code, signal) {
        try {
            // maybe process error codes
            this.debug.error(`Stream ${this.key}|${this.streamUrl} exited with code ${code} and signal ${signal}`);

            // but now we just restart
            this.cleanupStream();
            if (this.initialized) this.retryTimeout = setTimeout(this.startStream.bind(this), this.retryInterval);
        } catch (e) {
            this.debug.warn(`error while handling rtsp stream exit - ${e.message}`);
        }
    }
}
