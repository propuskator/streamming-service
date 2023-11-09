/* eslint-disable no-param-reassign */
import _Flatten from 'lodash/flatten';
import { DataTypes as DT, Op } from 'sequelize';
import _Uniq from 'lodash/uniq';
import sequelize               from '../sequelizeSingleton';
import Base                    from './WorkspaceModelBase';
import AccessSetting           from './AccessSetting';
import AccessReadersGroup           from './AccessReadersGroup';
import AccessSubject           from './AccessSubject';
import AccessTokenToReaderChangesMap from './AccessTokenToReaderChangesMap';
import SettingToScheduleMap    from './mappings/SettingToScheduleMap';
import AccessScheduleDate      from './AccessScheduleDate';

class AccessSchedule extends Base {
    static initRelations() {
        super.initRelations();
        this.AssociationAccessSettings = this.belongsToMany(AccessSetting, { through: SettingToScheduleMap, as: 'accessSettings', foreignKey: 'accessScheduleId', otherKey: 'accessSettingId' });
        this.AssociationSettingToScheduleMap = this.hasMany(SettingToScheduleMap, { as: 'settingToScheduleMap', foreignKey: 'accessScheduleId' });

        this.AssociationAccessScheduleDates = this.hasMany(AccessScheduleDate, { as: 'accessScheduleDates', foreignKey: 'scheduleId' });
    }

    async updateReaderTokens(options) {
        const accessSettings = await this.getAccessSettings({
            ...options,
            attributes : [ 'id' ],
            include    : [
                {
                    association : AccessSetting.AssociationAccessTokenReaders,
                    attributes  : [ 'id' ],
                    required    : false
                },
                {
                    association : AccessSetting.AssociationAccessReadersGroups,
                    include     : [ {
                        association : AccessReadersGroup.AssociationAccessTokenReaders,
                        attributes  : [ 'id' ],
                        required    : false
                    } ],
                    attributes : [ 'id' ],
                    required   : false
                },
                {
                    association : AccessSetting.AssociationAccessSubjects,
                    include     : [ {
                        association : AccessSubject.AssociationAccessSubjectTokens,
                        attributes  : [ 'id', 'code' ],
                        required    : false
                    } ],
                    attributes : [ 'id', 'mobileEnabled', 'virtualCode' ],
                    required   : false
                }
            ]
        });

        const accessTokenReaderIds = _Uniq([
            ..._Flatten(accessSettings.map(accessSetting => {
                return [
                    ...accessSetting.accessTokenReaders.map(({ id }) => id),
                    ..._Flatten(accessSetting.accessReadersGroups.map(({ accessTokenReaders }) => {
                        return accessTokenReaders.map(({ id }) => id);
                    }))
                ];
            }))
        ]);
        const accessSubjectTokenCodes = _Uniq([
            ..._Flatten(accessSettings.map(({ accessSubjects }) => {
                return [
                    ..._Flatten(accessSubjects.map(({ accessSubjectTokens }) => {
                        return accessSubjectTokens.map(({ code }) => code);
                    })),
                    ...accessSubjects.filter(({ mobileEnabled }) => mobileEnabled).map(({ mobileToken }) => mobileToken), // eslint-disable-line max-len
                    ...accessSubjects.filter(({ phoneEnabled }) => phoneEnabled).map(({ phoneToken }) => phoneToken)
                ];
            }))
        ]);

        await AccessTokenToReaderChangesMap.addUpdates({ accessTokenReaderIds, accessSubjectTokenCodes }, options);
    }

    static async findAllByParams({ ids, limit, offset, sortedBy, order, ...filters }, options = {}) {
        const filterScopes = [
            { method: [ 'ids', ids ] },
            { method: [ 'search', filters.search ] },
            { method: [ 'enabled', filters.enabled ] },
            { method: [ 'isArchived', filters.isArchived ] },
            { method: [ 'periodicity', filters.periodicity ] },
            { method : [ 'updateDates', {
                updateStart : filters.updateStart,
                updateEnd   : filters.updateEnd
            } ] },
            { method : [ 'createDates', {
                createStart : filters.createStart,
                createEnd   : filters.createEnd
            } ] }
        ];

        const { rows: accessSchedules, count } = await AccessSchedule.scope(filterScopes).findAndCountAll({
            ...options,
            ...(ids) ? {} : { limit, offset },
            include : [
                {
                    association : AccessSchedule.AssociationAccessScheduleDates,
                    required    : false
                }
            ],
            order    : [ [ sortedBy, order ], [ 'id', 'ASC' ] ],
            subQuery : false,
            distinct : true
        });

        return { accessSchedules, count };
    }
}
AccessSchedule.init({
    id             : { type: DT.BIGINT, primaryKey: true, autoIncrement: true },
    // eslint-disable-next-line max-len
    workspaceId    : { type: DT.BIGINT, allowNull: false, defaultValue: () => AccessSchedule.getWorkspaceIdFromNamespace() }, // eslint-disable-line max-len
    name           : { type: DT.STRING, allowNull: false },
    enabled        : { type: DT.BOOLEAN, allowNull: false, defaultValue: true },
    isArchived     : { type: DT.BOOLEAN, allowNull: false, defaultValue: false },
    popularityCoef : { type: DT.INTEGER, allowNull: false, defaultValue: 0 },
    createdAt      : { type: DT.DATE(3) },
    updatedAt      : { type: DT.DATE(3) },
    deletedAt      : { type: DT.DELETED_AT_DATE(3), allowNull: false, defaultValue: { [Op.eq]: sequelize.literal('0') } }
}, {
    paranoid   : true,
    timestamps : true,
    deletedAt  : 'deletedAt',
    createdAt  : false,
    updatedAt  : false,
    hooks      : {
        beforeUpdate : (model) => {
            if (model.changed('enabled') && model.isArchived) throw new Error('Cannot enable archived entity');
            if (model.changed('isArchived') && model.isArchived) model.enabled = false;
        },
        beforeCreate : (model) => {
            if (model.enabled && model.isArchived) throw new Error('Cannot enable archived entity');
        }// ,
        // beforeSave : async (model, options) => {
        //    if (model.changed('enabled') || model.changed('isArchived')) await model.updateReaderTokens(options);
        // }
    },
    scopes : {
        ids(ids) {
            if (ids) {
                return {
                    where : { id: ids }
                };
            }

            return {};
        },
        search(search) {
            if (search) {
                return {
                    where : {
                        name : {
                            [Op.like] : `%${search}%`
                        }
                    }
                };
            }

            return {};
        },
        updateDates({ updateStart, updateEnd }) {
            if (updateStart && updateEnd) {
                return {
                    where : {
                        updatedAt : {
                            [Op.gte] : updateStart,
                            [Op.lte] : updateEnd
                        }
                    }
                };
            }

            return {};
        },
        createDates({ createStart, createEnd }) {
            if (createStart && createEnd) {
                return {
                    where : {
                        createdAt : {
                            [Op.gte] : createStart,
                            [Op.lte] : createEnd
                        }
                    }
                };
            }

            return {};
        },
        enabled(enabled) {
            if (typeof enabled === 'boolean') {
                return {
                    where : { enabled }
                };
            }

            return {};
        },
        isArchived(isArchived) {
            if (typeof isArchived === 'boolean') {
                return {
                    where : { isArchived }
                };
            }

            return {};
        },
        periodicity(periodicity) {
            if (periodicity === 'PERIODIC') {
                return {
                    where : {
                        [Op.or] : {
                            '$accessScheduleDates.weekBitMask$'  : { [Op.not]: null },
                            '$accessScheduleDates.monthBitMask$' : { [Op.not]: null }
                        }
                    }
                };
            } else if (periodicity === 'NOT_PERIODIC') {
                return {
                    where : {
                        '$accessScheduleDates.weekBitMask$'  : null,
                        '$accessScheduleDates.monthBitMask$' : null
                    }
                };
            }

            return {};
        }
    },
    sequelize
});

export default AccessSchedule;
