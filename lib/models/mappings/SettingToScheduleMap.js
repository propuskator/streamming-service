import { DataTypes as DT } from 'sequelize';
import Base                from '../Base';
import sequelize           from '../../sequelizeSingleton';
import AccessSetting       from '../AccessSetting';
import AccessSchedule      from '../AccessSchedule';

class SettingToScheduleMap extends Base {
    static initRelations() {
        this.AssociationAccessSetting = this.belongsTo(AccessSetting, { as: 'accessSetting', foreignKey: 'accessSettingId' });
        this.AssociationAccessSchedule = this.belongsTo(AccessSchedule, { as: 'accessSchedule', foreignKey: 'accessScheduleId' });
    }
}
SettingToScheduleMap.init({
    accessSettingId  : { type: DT.BIGINT, allowNull: false, primaryKey: true },
    accessScheduleId : { type: DT.BIGINT, allowNull: false, primaryKey: true },
    createdAt        : { type: DT.DATE(3) }
}, {
    tableName  : 'SettingToScheduleMap',
    timestamps : false,
    sequelize
});

export default SettingToScheduleMap;
