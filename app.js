import sequelize from './lib/sequelize';
import { initLogger }   from './lib/extensions/Logger';
import StreamService   from './lib/services/StreamService';
import Server   from './lib/services/Server';

import { wsPort } from './lib/config';

const logger = initLogger('App');

const streamService = new StreamService({
    debug : initLogger('MqttProxy')
});

const server = new Server({
    port  : wsPort,
    debug : initLogger('Server')
});

server.on('client', streamService.handleClient);

async function start() {
    try {
        await streamService.init();
        await server.start();
    } catch (e) {
        console.log(e);
        logger.error(e);
        process.exit(1);
    }
}

async function shutdown() {
    logger.info('Closing server');
    await server.stop();

    logger.info('Closing streamService');
    await streamService.destroy();

    logger.info('Closing sequelize connections');
    await sequelize.close(false);

    logger.info('Exit');
    process.exit(0);
}

// Subscribe to system signals
process.on('SIGTERM', async () => {
    logger.info('SIGTERM signal catched');

    await shutdown();
});

process.on('SIGINT', async () => {
    logger.info('SIGINT signal catched');

    await shutdown();
});

start();
