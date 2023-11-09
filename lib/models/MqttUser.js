/* eslint-disable camelcase */
import { DataTypes as DT } from 'sequelize';
import sequelize           from '../sequelizeSingleton';
import Base                from './Base';


class MqttUser extends Base {}

MqttUser.init({
    id           : { type: DT.BIGINT, primaryKey: true, autoIncrement: true },
    username     : { type: DT.STRING, defaultValue: null, unique: 'mqtt_username' },
    password     : { type: DT.STRING, defaultValue: null },
    salt         : { type: DT.STRING, defaultValue: null },
    is_superuser : { type: DT.TINYINT, defaultValue: 0 },
    createdAt    : { type: DT.DATE(3) },
    updatedAt    : { type: DT.DATE(3) }
}, {
    tableName  : 'mqtt_user',
    timestamps : false,
    sequelize
});

export default MqttUser;
