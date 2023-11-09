/* eslint-disable more/no-then */
/* eslint-disable no-param-reassign */
import { DataTypes as DT, Op } from 'sequelize';
import _Flatten from 'lodash/flatten';
import _Uniq from 'lodash/uniq';
import sequelize            from '../sequelizeSingleton';
import Base                 from './WorkspaceModelBase';
import AccessReadersGroup   from './AccessReadersGroup';
import SettingToGroupMap    from './mappings/SettingToGroupMap';
import AccessTokenReader    from './AccessTokenReader';
import SettingToReaderMap   from './mappings/SettingToReaderMap';
import AccessSchedule       from './AccessSchedule';
import SettingToScheduleMap from './mappings/SettingToScheduleMap';
import AccessSubject        from './AccessSubject';
import SettingToSubjectMap  from './mappings/SettingToSubjectMap';
import AccessTokenToReaderChangesMap from './AccessTokenToReaderChangesMap';

class AccessSetting extends Base {
    static initRelations() {
        super.initRelations();
        this.AssociationAccessReadersGroups = this.belongsToMany(AccessReadersGroup, { through: SettingToGroupMap, as: 'accessReadersGroups', foreignKey: 'accessSettingId', otherKey: 'accessReadersGroupId' });
        this.AssociationSettingToGroupMap = this.hasMany(SettingToGroupMap, { as: 'settingToGroupMap', foreignKey: 'accessSettingId' });

        this.AssociationAccessTokenReaders = this.belongsToMany(AccessTokenReader, { through: SettingToReaderMap, as: 'accessTokenReaders', foreignKey: 'accessSettingId', otherKey: 'accessTokenReaderId' });
        this.AssociationSettingToReaderMap = this.hasMany(SettingToReaderMap, { as: 'settingToReaderMap', foreignKey: 'accessSettingId' });

        this.AssociationAccessSchedules = this.belongsToMany(AccessSchedule, { through: SettingToScheduleMap, as: 'accessSchedules', foreignKey: 'accessSettingId', otherKey: 'accessScheduleId' });
        this.AssociationSettingToScheduleMap = this.hasMany(SettingToScheduleMap, { as: 'settingToScheduleMap', foreignKey: 'accessSettingId' });

        this.AssociationAccessSubjects = this.belongsToMany(AccessSubject, { through: SettingToSubjectMap, as: 'accessSubjects', foreignKey: 'accessSettingId', otherKey: 'accessSubjectId' });
        this.AssociationSettingToSubjectMap = this.hasMany(SettingToSubjectMap, { as: 'settingToSubjectMap', foreignKey: 'accessSettingId' });
    }

    async updateReaderTokens(options) {
        // its important to load only ids to safely use this in hooks
        await this.reload({
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
            ...this.accessTokenReaders.map(({ id }) => id),
            ..._Flatten(this.accessReadersGroups.map(({ accessTokenReaders }) => {
                return accessTokenReaders.map(({ id }) => id);
            }))
        ]);
        const accessSubjectTokenCodes = _Uniq([
            ..._Flatten(this.accessSubjects.map(({ accessSubjectTokens }) => {
                return accessSubjectTokens.map(({ code }) => code);
            })),
            ...this.accessSubjects.filter(({ mobileEnabled }) => mobileEnabled).map(({ mobileToken }) => mobileToken),
            ...this.accessSubjects.filter(({ phoneEnabled }) => phoneEnabled).map(({ phoneToken }) => phoneToken)
        ]);

        await AccessTokenToReaderChangesMap.addUpdates({ accessTokenReaderIds, accessSubjectTokenCodes }, options);
    }

    // eslint-disable-next-line max-lines-per-function
    static async findAllByParams({ ids, limit, offset, sortedBy, order,  ...filters }, options = {}) {
        const filterScopes = [
            { method: [ 'ids', ids ] },
            { method: [ 'search', filters.search ] },
            { method: [ 'enabled', filters.enabled ] },
            { method: [ 'isArchived', filters.isArchived ] },
            { method : [ 'updateDates', {
                updateStart : filters.updateStart,
                updateEnd   : filters.updateEnd
            } ] },
            { method : [ 'createDates', {
                createStart : filters.createStart,
                createEnd   : filters.createEnd
            } ] },
            { method: [ 'accessSubjectIds', filters.accessSubjectIds ] },
            { method: [ 'accessScheduleIds', filters.accessScheduleIds ] },
            { method: [ 'accessTokenReaderAndReadersGroupIds', { accessTokenReaderIds: filters.accessTokenReaderIds, accessReadersGroupIds: filters.accessReadersGroupIds } ] }
            // { method: [ 'accessTokenReaderIds', filters.accessTokenReaderIds ] },
            // { method: [ 'accessReadersGroupIds', filters.accessReadersGroupIds ] }
        ];

        const { rows: accessSettings, count } = await AccessSetting.scope(filterScopes).findAndCountAll({
            ...options,
            ...(ids) ? {} : { limit, offset },
            // benchmark : true,
            include : [
                {
                    association : AccessSetting.AssociationAccessReadersGroups,
                    attributes  : [],
                    required    : false
                },
                {
                    association : AccessSetting.AssociationAccessTokenReaders,
                    attributes  : [],
                    required    : false
                },
                {
                    association : AccessSetting.AssociationAccessSchedules,
                    attributes  : [],
                    required    : false,
                    include     : [
                        {
                            association : AccessSchedule.AssociationAccessScheduleDates,
                            attributes  : []
                        }
                    ]
                },
                {
                    association : AccessSetting.AssociationAccessSubjects,
                    attributes  : [],
                    required    : false,
                    include     : [
                        {
                            association : AccessSubject.AssociationAccessSubjectTokens,
                            attributes  : [],
                            required    : false
                        }
                    ]
                }
            ],
            group    : [ 'AccessSetting.id' ],
            // attributes : [ 'id' ],
            order    : [ [ sortedBy, order ], [ 'id', 'ASC' ] ],
            subQuery : false,
            distinct : true
        });


        // const accessSettings = rows.length ? await AccessSetting.findAll({
        //     where : {
        //         id : rows.map(({ id }) => id)
        //     }
        //     benchmark : true,
        //     include   : [
        //         {
        //             association : AccessSetting.AssociationAccessReadersGroups,
        //             required    : false,
        //             include     : [
        //                 {
        //                     association : AccessReadersGroup.AssociationAccessTokenReaders,
        //                     required    : false
        //                 }
        //             ]
        //         },
        //         {
        //             association : AccessSetting.AssociationAccessTokenReaders,
        //             required    : false
        //         },
        //         {
        //             association : AccessSetting.AssociationAccessSchedules,
        //             required    : false,
        //             include     : [ AccessSchedule.AssociationAccessScheduleDates ]
        //         },
        //         {
        //             association : AccessSetting.AssociationAccessSubjects,
        //             required    : false,
        //             include     : [
        //                 {
        //                     association : AccessSubject.AssociationAccessSubjectTokens,
        //                     required    : false
        //                 }
        //             ]
        //         }
        //     ],
        //     order : [ [ sortedBy, order ], [ 'id', 'ASC' ] ]
        // }) : [];


        for (const accessSetting of accessSettings) {
            accessSetting.accessReadersGroups = [];
            accessSetting.accessTokenReaders = [];
            accessSetting.accessSchedules = [];
            accessSetting.accessSubjects = [];
        }

        const hash = Object.fromEntries(accessSettings.map(accessSetting => [ accessSetting.id, accessSetting ]));

        const association = {
            // association : AccessReadersGroup.AssociationAccessSettings,
            required   : true,
            attributes : [ 'id' ],
            where      : {
                id : accessSettings.map(({ id }) => id)
            }
        };

        await Promise.all([
            AccessReadersGroup.findAll({
                include : [
                    {
                        association : AccessReadersGroup.AssociationAccessTokenReaders,
                        required    : false
                    },
                    {
                        ...association,
                        association : AccessReadersGroup.AssociationAccessSettings
                    }
                ]
            }).then(accessReadersGroups => {
                for (const accessReadersGroup of accessReadersGroups) {
                    for (const { id } of accessReadersGroup.accessSettings) {
                        hash[id].accessReadersGroups.push(accessReadersGroup);
                    }
                }
            }),
            AccessTokenReader.findAll({
                include : {
                    ...association,
                    association : AccessTokenReader.AssociationAccessSettings
                }
            }).then(accessTokenReaders => {
                for (const accessTokenReader of accessTokenReaders) {
                    for (const { id } of accessTokenReader.accessSettings) {
                        hash[id].accessTokenReaders.push(accessTokenReader);
                    }
                }
            }),
            AccessSchedule.findAll({
                include : [
                    AccessSchedule.AssociationAccessScheduleDates,
                    {
                        ...association,
                        association : AccessSchedule.AssociationAccessSettings
                    }
                ]
            }).then(accessSchedules => {
                for (const accessSchedule of accessSchedules) {
                    for (const { id } of accessSchedule.accessSettings) {
                        hash[id].accessSchedules.push(accessSchedule);
                    }
                }
            }),
            AccessSubject.findAll({
                include : [
                    {
                        association : AccessSubject.AssociationAccessSubjectTokens,
                        required    : false
                    },
                    {
                        ...association,
                        association : AccessSubject.AssociationAccessSettings
                    }
                ]
            }).then(accessSubjects => {
                for (const accessSubject of accessSubjects) {
                    for (const { id } of accessSubject.accessSettings) {
                        hash[id].accessSubjects.push(accessSubject);
                    }
                }
            })
        ]);

        // await Promise.all(accessSettings.map(accessSetting => {
        //     return Promise.all([
        //         accessSetting.getAccessReadersGroups({
        //             include : [
        //                 {
        //                     association : AccessReadersGroup.AssociationAccessTokenReaders,
        //                     required    : false
        //                 }
        //             ]
        //         }).then(accessReadersGroups => accessSetting.accessReadersGroups = accessReadersGroups),
        //         accessSetting.getAccessTokenReaders().then(accessTokenReaders =>
        //             accessSetting.accessTokenReaders = accessTokenReaders),
        //         accessSetting.getAccessSchedules({
        //             include : [ AccessSchedule.AssociationAccessScheduleDates ]
        //         }).then(accessSchedules => accessSetting.accessSchedules = accessSchedules),
        //         accessSetting.getAccessSubjects({
        //             include : [
        //                 {
        //                     association : AccessSubject.AssociationAccessSubjectTokens,
        //                     required    : false
        //                 }
        //             ]
        //         }).then(accessSubjects => accessSetting.accessSubjects = accessSubjects)
        //     ]);
        // }));

        return { accessSettings, count: count && count.length || 0 };
    }
}
AccessSetting.init({
    id          : { type: DT.BIGINT, primaryKey: true, autoIncrement: true },
    // eslint-disable-next-line max-len
    workspaceId : { type: DT.BIGINT, allowNull: false, defaultValue: () => AccessSetting.getWorkspaceIdFromNamespace() },
    enabled     : { type: DT.BOOLEAN, allowNull: false, defaultValue: true },
    isArchived  : { type: DT.BOOLEAN, allowNull: false, defaultValue: false },
    createdAt   : { type: DT.DATE(3) },
    updatedAt   : { type: DT.DATE(3) },
    deletedAt   : { type: DT.DELETED_AT_DATE(3), allowNull: false, defaultValue: { [Op.eq]: sequelize.literal('0') } }
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
        accessSubjectIds(accessSubjectIds) {
            if (accessSubjectIds && accessSubjectIds.length) {
                return {
                    where : {
                        '$accessSubjects.id$' : accessSubjectIds
                    }
                };
            }

            return {};
        },
        accessScheduleIds(accessScheduleIds) {
            if (accessScheduleIds && accessScheduleIds.length) {
                return {
                    where : {
                        '$accessSchedules.id$' : accessScheduleIds
                    }
                };
            }

            return {};
        },
        accessTokenReaderAndReadersGroupIds({ accessTokenReaderIds, accessReadersGroupIds }) {
            const orarr = [];

            if (accessTokenReaderIds && accessTokenReaderIds.length) orarr.push({ '$accessTokenReaders.id$': accessTokenReaderIds });
            if (accessReadersGroupIds && accessReadersGroupIds.length) orarr.push({ '$accessReadersGroups.id$': accessReadersGroupIds });
            if (orarr.length) {
                return {
                    where : {
                        [Op.or] : orarr
                    }
                };
            }

            return  {};
        },
        accessTokenReaderIds(accessTokenReaderIds) {
            if (accessTokenReaderIds && accessTokenReaderIds.length) {
                return {
                    where : {
                        '$accessTokenReaders.id$' : accessTokenReaderIds
                    }
                };
            }

            return {};
        },
        accessReadersGroupIds(accessReadersGroupIds) {
            if (accessReadersGroupIds && accessReadersGroupIds.length) {
                return {
                    where : {
                        '$accessReadersGroups.id$' : accessReadersGroupIds
                    }
                };
            }

            return {};
        },
        search(search) {
            if (search) {
                return {
                    where : {
                        '$accessSubjects.name$' : {
                            [Op.like] : `%${search}%`
                        }
                    }
                };
            }

            return {};
        }
    },
    sequelize
});
export default AccessSetting;
