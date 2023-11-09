import { DataTypes as DT } from 'sequelize';
import Base                from '../Base';
import sequelize           from '../../sequelizeSingleton';
import AccessSetting       from '../AccessSetting';
import AccessReadersGroup  from '../AccessReadersGroup';

class SettingToGroupMap extends Base {
    static initRelations() {
        this.AssociationAccessSetting = this.belongsTo(AccessSetting, { as: 'accessSetting', foreignKey: 'accessSettingId' });
        this.AssociationAccessReadersGroup = this.belongsTo(AccessReadersGroup, { as: 'accessReadersGroup', foreignKey: 'accessReadersGroupId' });
    }
}
SettingToGroupMap.init({
    accessSettingId      : { type: DT.BIGINT, allowNull: false, primaryKey: true },
    accessReadersGroupId : { type: DT.BIGINT, allowNull: false, primaryKey: true },
    createdAt            : { type: DT.DATE(3) }
}, {
    tableName  : 'SettingToGroupMap',
    timestamps : false,
    sequelize
});

export default SettingToGroupMap;
