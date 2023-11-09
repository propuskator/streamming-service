/* eslint-disable camelcase */
import { DataTypes as DT } from 'sequelize';
import sequelize           from '../sequelizeSingleton';
import Base                from './Base';


class MqttAcl extends Base {}

MqttAcl.init({
    id        : { type: DT.BIGINT, primaryKey: true, autoIncrement: true },
    allow     : { type: DT.INTEGER, defaultValue: null, comment: '0: deny, 1: allow' },
    ipaddr    : { type: DT.STRING, defaultValue: null },
    username  : { type: DT.STRING, defaultValue: null },
    clientid  : { type: DT.STRING, defaultValue: null },
    access    : { type: DT.INTEGER, allowNull: false, comment: '1: subscribe, 2: publish, 3: pubsub' },
    topic     : { type: DT.STRING, defaultValue: '', allowNull: false },
    createdAt : { type: DT.DATE(3) },
    updatedAt : { type: DT.DATE(3) }
}, {
    tableName  : 'mqtt_acl',
    timestamps : false,
    sequelize
});

export default MqttAcl;
