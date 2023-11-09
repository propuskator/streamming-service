/* eslint-disable prefer-spread/prefer-object-spread */
/* eslint-disable no-param-reassign */
/* eslint-disable import/no-commonjs,more/no-then,func-style,brace-style,default-case,import/newline-after-import,
func-names */
import Sequelize from 'sequelize';
import cls       from './cls';

// fix seqielize connections
const Promise = require('bluebird');
const _ = require('underscore');
const Transaction = require('sequelize/lib/transaction');
const { QueryInterface } = require('sequelize/lib/dialects/abstract/query-interface');
const ConnectionManager = require('sequelize/lib/dialects/mysql/connection-manager');
const SequelizeErrors = require('sequelize/lib/errors');
const { logger } = require('sequelize/lib/utils/logger');
const debug = logger.debugContext('connection:mysql');
const momentTz = require('moment-timezone');


// fix mysql reconnect error
class FixedSequelize extends Sequelize {
    transaction(options, autoCallback) {
        if (typeof options === 'function') {
            autoCallback = options;
            options = undefined;
        }

        options = options || {};
        if (options.transaction === undefined && Sequelize._cls) {
            options.transaction = Sequelize._cls.get('transaction');
        }

        // return super.transaction(options, autoCallback); //old, now we need more fixes

        const transaction = new Transaction(this, options);

        if (transaction.parent) {
            // eslint-disable-next-line prefer-template
            transaction.name = transaction.parent.name + '-sp-' + transaction.parent.savepoints.length;
        }

        if (!autoCallback) return transaction.prepareEnvironment(false).return(transaction);

        // autoCallback provided
        return Sequelize._clsRun(() => {
            return transaction.prepareEnvironment()
                .then(() => autoCallback(transaction))
                .tap(() => transaction.commit())
                .catch(err => {
                // Rollback transaction if not already finished (commit, rollback, etc)
                // and reject with original error (ignore any error in rollback)
                    return Promise.try(() => {
                        if (!transaction.finished) return transaction.rollback().catch(() => {});
                    }).throw(err);
                });
        });
    }
}
QueryInterface.prototype.startTransaction = function (transaction, options) {
    if (!transaction || !(transaction instanceof Transaction)) {
        throw new Error('Unable to start a transaction without transaction object!');
    }

    options = _.assign({}, options, {
        transaction : transaction.parent || transaction
    });
    // options.transaction.name = transaction.parent ? transaction.name : undefined;
    const sql = this.QueryGenerator.startTransactionQuery(transaction);

    return this.sequelize.query(sql, options);
};

QueryInterface.prototype.rollbackTransaction = function (transaction, options) {
    if (!transaction || !(transaction instanceof Transaction)) {
        throw new Error('Unable to rollback a transaction without transaction object!');
    }

    options = _.assign({}, options, {
        transaction        : transaction.parent || transaction,
        supportsSearchPath : false
    });
    // options.transaction.name = transaction.parent ? transaction.name : undefined;
    const sql = this.QueryGenerator.rollbackTransactionQuery(transaction);
    const promise = this.sequelize.query(sql, options);

    transaction.finished = 'rollback';

    return promise;
};

ConnectionManager.prototype.connect = function (config) {
    const connectionConfig = {
        host              : config.host,
        port              : config.port,
        user              : config.username,
        flags             : '-FOUND_ROWS',
        password          : config.password,
        database          : config.database,
        timezone          : this.sequelize.options.timezone,
        typeCast          : ConnectionManager._typecast.bind(this),
        bigNumberStrings  : false,
        supportBigNumbers : true
    };

    if (config.dialectOptions) {
        for (const key of Object.keys(config.dialectOptions)) {
            connectionConfig[key] = config.dialectOptions[key];
        }
    }

    return Promise.race([
        new Promise((resolve, reject) => {
            const connection = this.lib.createConnection(connectionConfig);

            const errorHandler = e => {
                // clean up connect & error event if there is error
                connection.removeListener('connect', connectHandler);
                if (config.pool.handleDisconnects) {
                    debug(`connection error ${e.code}`);

                    if (e.code === 'PROTOCOL_CONNECTION_LOST') {
                        this.pool.destroy(connection)
                            .catch(/Resource not currently part of this pool/, () => {});
                    }
                }

                connection.removeListener('error', connectHandler);
                reject(e);
            };

            const connectHandler = () => {
                // clean up error event if connected
                connection.removeListener('error', errorHandler);
                resolve(connection);
            };

            connection.on('error', errorHandler);
            connection.once('connect', connectHandler);
        })
            .tap(() => { debug('connection acquired'); })
            .then(connection => {
                connection.on('error', error => {
                    switch (error.code) {
                        case 'ESOCKET':
                        case 'ECONNRESET':
                        case 'EPIPE':
                        case 'PROTOCOL_CONNECTION_LOST':
                            this.pool.destroy(connection);
                    }
                });

                return new Promise((resolve, reject) => {
                    // set timezone for this connection
                    // but named timezone are not directly supported in mysql, so get its offset first
                    let tzOffset = this.sequelize.options.timezone;

                    tzOffset = /\//.test(tzOffset) ? momentTz.tz(tzOffset).format('Z') : tzOffset;
                    connection.query(`SET time_zone = '${tzOffset}'`, err => {
                        if (err) { reject(err); } else { resolve(connection); }
                    });
                });
            })
            .catch(err => {
                switch (err.code) {
                    case 'ECONNREFUSED':
                        throw new SequelizeErrors.ConnectionRefusedError(err);
                    case 'ER_ACCESS_DENIED_ERROR':
                        throw new SequelizeErrors.AccessDeniedError(err);
                    case 'ENOTFOUND':
                        throw new SequelizeErrors.HostNotFoundError(err);
                    case 'EHOSTUNREACH':
                        throw new SequelizeErrors.HostNotReachableError(err);
                    case 'EINVAL':
                        throw new SequelizeErrors.InvalidConnectionError(err);
                    default:
                        throw new SequelizeErrors.ConnectionError(err);
                }
            }),
        Promise.delay(10000).then(() => {
            throw new Error('Connection creation timed out');
        })
    ]);
};
// end fix

// memory leak when running tests
Sequelize.useCLS(cls);

// eslint-disable-next-line import/no-commonjs
const config    = require('./config')[process.env.MODE === 'application' ? 'db' : 'test-db'];

const { database, username, password, dialect, host, port } = config;

const timezonehoursoffset = -(new Date().getTimezoneOffset() / 60);

let timezone = `${timezonehoursoffset}`;

timezone = `${'0'.repeat(2 - timezone.length)}${timezone}`;

timezone = `${Math.sign(timezonehoursoffset) >= 0 ? '+' : '-'}${timezone}:00`;

const sequelize = new FixedSequelize(database, username, password, {
    host,
    port,
    dialect,
    logging        : false,
    dialectOptions : {
        supportBigNumbers : true,
        bigNumberStrings  : true,
        connectTimeout    : 10000
    },
    pool : {
        min     : 10,
        max     : 100,
        idle    : 10000, // The maximum time, in milliseconds, that a connection can be idle before being released.
        acquire : 30000 // ..., that pool will try to get connection before throwing error
    },
    retry : { // Set of flags that control when a query is automatically retried.
        match : [
            /SequelizeConnectionError/,
            /SequelizeConnectionRefusedError/,
            /SequelizeHostNotFoundError/,
            /SequelizeHostNotReachableError/,
            /SequelizeInvalidConnectionError/,
            /SequelizeConnectionTimedOutError/,
            /TimeoutError/
        ],
        max : 4 // How many times a failing query is automatically retried.
    },
    timezone
});

export default sequelize;
