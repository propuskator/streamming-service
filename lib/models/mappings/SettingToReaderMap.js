import { DataTypes as DT } from 'sequelize';
import Base                from '../Base';
import sequelize           from '../../sequelizeSingleton';
import AccessSetting       from '../AccessSetting';
import AccessTokenReader   from '../AccessTokenReader';

class SettingToReaderMap extends Base {
    static initRelations() {
        this.AssociationAccessSetting = this.belongsTo(AccessSetting, { as: 'accessSetting', foreignKey: 'accessSettingId' });
        this.AssociationAccessTokenReader = this.belongsTo(AccessTokenReader, { as: 'accessTokenReader', foreignKey: 'accessTokenReaderId' });
    }
}
SettingToReaderMap.init({
    accessSettingId     : { type: DT.BIGINT, allowNull: false, primaryKey: true },
    accessTokenReaderId : { type: DT.BIGINT, allowNull: false, primaryKey: true },
    createdAt           : { type: DT.DATE(3) }
}, {
    tableName  : 'SettingToReaderMap',
    timestamps : false,
    sequelize
});

export default SettingToReaderMap;
