/* eslint-disable no-param-reassign */
import { DataTypes as DT, Op } from 'sequelize';
import _Flatten from 'lodash/flatten';
import _Uniq from 'lodash/uniq';
import sequelize               from '../sequelizeSingleton';
import Base                    from './WorkspaceModelBase';
import AccessTokenReader       from './AccessTokenReader';
import GroupToReaderMap        from './mappings/GroupToReaderMap';
import AccessSetting           from './AccessSetting';
import SettingToGroupMap       from './mappings/SettingToGroupMap';
import AccessSubject from './AccessSubject';
import AccessTokenToReaderChangesMap from './AccessTokenToReaderChangesMap';

class AccessReadersGroup extends Base {
    static initRelations() {
        super.initRelations();
        this.AssociationAccessTokenReaders = this.belongsToMany(AccessTokenReader, { through: GroupToReaderMap, as: 'accessTokenReaders', foreignKey: 'accessReadersGroupId', otherKey: 'accessTokenReaderId' });
        this.AssociationGroupToReaderMap = this.hasMany(GroupToReaderMap, { as: 'groupToReaderMap', foreignKey: 'accessReadersGroupId' });

        this.AssociationAccessSettings = this.belongsToMany(AccessSetting, { through: SettingToGroupMap, as: 'accessSettings', foreignKey: 'accessReadersGroupId', otherKey: 'accessSettingId' });
        this.AssociationSettingToGroupMap = this.hasMany(SettingToGroupMap, { as: 'settingToGroupMap', foreignKey: 'accessReadersGroupId' });
    }

    async updateReaderTokens(options) {
        const accessSettings = await this.getAccessSettings({
            ...options,
            attributes : [ 'id' ],
            include    : [
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
        const accessTokenReaders = await this.getAccessTokenReaders({
            ...options,
            attributes : [ 'id' ]
        });


        const accessTokenReaderIds = _Uniq(accessTokenReaders.map(({ id }) => id));
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
            { method : [ 'updateDates', {
                updateStart : filters.updateStart,
                updateEnd   : filters.updateEnd
            } ] },
            { method : [ 'createDates', {
                createStart : filters.createStart,
                createEnd   : filters.createEnd
            } ] }
        ];

        const { rows, count } = await AccessReadersGroup.scope(filterScopes).findAndCountAll({
            ...options,
            ...(ids) ? {} : { limit, offset },
            include : [
                {
                    association : AccessReadersGroup.AssociationAccessTokenReaders,
                    attributes  : [],
                    required    : false
                }
            ],
            group      : [ 'AccessReadersGroup.id' ],
            attributes : [ 'id' ],
            order      : [ [ sortedBy, order ], [ 'id', 'ASC' ] ],
            subQuery   : false,
            distinct   : true
        });

        const accessReadersGroups = rows.length ? await AccessReadersGroup.findAll({
            where : {
                id : rows.map(({ id }) => id)
            },
            include : [
                {
                    association : AccessReadersGroup.AssociationAccessTokenReaders,
                    required    : false
                }
            ],
            order : [ [ sortedBy, order ], [ 'id', 'ASC' ] ]
        }) : [];

        return { accessReadersGroups, count: count && count.length || 0 };
    }
}

AccessReadersGroup.init({
    id             : { type: DT.BIGINT, primaryKey: true, autoIncrement: true },
    // eslint-disable-next-line max-len
    workspaceId    : { type: DT.BIGINT, allowNull: false, defaultValue: () => AccessReadersGroup.getWorkspaceIdFromNamespace() }, // eslint-disable-line max-len
    name           : { type: DT.STRING, allowNull: false },
    color          : { type: DT.STRING, allowNull: false },
    popularityCoef : { type: DT.INTEGER, allowNull: false, defaultValue: 0 },
    enabled        : { type: DT.BOOLEAN, allowNull: false, defaultValue: true },
    isArchived     : { type: DT.BOOLEAN, allowNull: false, defaultValue: false },
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
        }
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
                        [Op.or] : [
                            {
                                name : {
                                    [Op.like] : `%${search}%`
                                }
                            },
                            {
                                '$accessTokenReaders.name$' : {
                                    [Op.like] : `%${search}%`
                                }
                            }
                        ]
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
        }
    },
    sequelize
});

export default AccessReadersGroup;
