import { DataTypes as DT } from 'sequelize';
import Base                from '../Base';
import sequelize           from '../../sequelizeSingleton';
import AccessSetting       from '../AccessSetting';
import AccessSubject       from '../AccessSubject';

class SettingToSubjectMap extends Base {
    static initRelations() {
        this.AssociationAccessSetting = this.belongsTo(AccessSetting, { as: 'accessSetting', foreignKey: 'accessSettingId' });
        this.AssociationAccessSubject = this.belongsTo(AccessSubject, { as: 'accessSubject', foreignKey: 'accessSubjectId' });
    }
}
SettingToSubjectMap.init({
    accessSettingId : { type: DT.BIGINT, allowNull: false, primaryKey: true },
    accessSubjectId : { type: DT.BIGINT, allowNull: false, primaryKey: true },
    createdAt       : { type: DT.DATE(3) }
}, {
    tableName  : 'SettingToSubjectMap',
    timestamps : false,
    sequelize
});

export default SettingToSubjectMap;
