import { DataTypes as DT } from 'sequelize';
import sequelize           from '../sequelizeSingleton';
import Base                from './Base';
import AccessSchedule      from './AccessSchedule';

class AccessScheduleDate extends Base {
    static initRelations() {
        this.AssociationAccessSchedule = this.belongsTo(AccessSchedule, { as: 'accessSchedule', foreignKey: 'scheduleId' });
    }
}
AccessScheduleDate.init({
    id                 : { type: DT.BIGINT, primaryKey: true, autoIncrement: true },
    scheduleId         : { type: DT.BIGINT, allowNull: false },
    from               : { type: DT.DATE(3), allowNull: true },
    to                 : { type: DT.DATE(3), allowNull: true },
    weekBitMask        : { type: DT.INTEGER.UNSIGNED, allowNull: true },
    monthBitMask       : { type: DT.INTEGER.UNSIGNED, allowNull: true },
    dailyIntervalStart : { type: DT.INTEGER, allowNull: true },
    dailyIntervalEnd   : { type: DT.INTEGER, allowNull: true },

    // startTime  : { type: DT.TIME, allowNull: false },
    // endTime    : { type: DT.TIME, allowNull: false },
    // date       : { type: DT.DATEONLY, allowNull: true },
    // dayOfWeek  : { type: DT.INTEGER, allowNull: true },
    // weekNumber : { type: DT.INTEGER, allowNull: true },
    // dayOfMonth : { type: DT.INTEGER, allowNull: true },

    createdAt : { type: DT.DATE(3) }
}, {
    timestamps : false,
    sequelize
});

export default AccessScheduleDate;
