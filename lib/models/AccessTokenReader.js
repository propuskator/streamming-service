/* eslint-disable func-style */
/* eslint-disable no-param-reassign,prefer-template */
import { DataTypes as DT, Op } from 'sequelize';
import _Flatten from 'lodash/flatten';
import _Uniq from 'lodash/uniq';
import sequelize          from '../sequelizeSingleton';
import Base               from './WorkspaceModelBase';
import AccessReadersGroup from './AccessReadersGroup';
import GroupToReaderMap   from './mappings/GroupToReaderMap';
import AccessSetting      from './AccessSetting';
import SettingToReaderMap from './mappings/SettingToReaderMap';
import AccessTokenToReaderChangesMap from './AccessTokenToReaderChangesMap';
import AccessSubject from './AccessSubject';
import UsersAccessTokenReadersOrder from './UsersAccessTokenReadersOrder';
import MqttUser from './MqttUser';
import MqttAcl from './MqttAcl';
import { createHash } from './utils';
import Workspace from './Workspace';

class AccessTokenReader extends Base {
    static STATE_DISCONNECTED = 'DISCONNECTED'

    static STATE_ACTIVE = 'ACTIVE'

    static STATE_INACTIVE = 'INACTIVE'

    static initRelations() {
        super.initRelations();
        this.AssociationAccessReadersGroups = this.belongsToMany(AccessReadersGroup, { through: GroupToReaderMap, as: 'accessReadersGroups', foreignKey: 'accessTokenReaderId', otherKey: 'accessReadersGroupId' });
        this.AssociationGroupToReaderMap = this.hasMany(GroupToReaderMap, { as: 'groupToReaderMap', foreignKey: 'accessTokenReaderId' });

        this.AssociationAccessSettings = this.belongsToMany(AccessSetting, { through: SettingToReaderMap, as: 'accessSettings', foreignKey: 'accessTokenReaderId', otherKey: 'accessSettingId' });
        this.AssociationSettingToReaderMap = this.hasMany(SettingToReaderMap, { as: 'settingToReaderMap', foreignKey: 'accessTokenReaderId' });
        this.AssociationUsersAccessTokenReadersOrder = this.hasMany(UsersAccessTokenReadersOrder, { as: 'usersAccessTokenReadersOrder', foreignKey: 'accessTokenReaderId' });

        this.AssociationSyncChanges = this.hasMany(AccessTokenToReaderChangesMap, { as: 'syncChanges', foreignKey: 'accessTokenReaderId' });
    }

    static async updateWithoutUpdateAt(id, updateActiveAt = false, fields = {}, options = {}) {
        return sequelize.query(
            'UPDATE `AccessTokenReaders` SET '
            + Object.keys(fields).map((k) => `\`${k}\`=:${k}, `).join('')
            + ((updateActiveAt) ? '`activeAt`=CURRENT_TIMESTAMP(3), ' : '')
            + '`updatedAt`=`updatedAt` WHERE `id` = :id',
            {
                ...options,
                replacements : {
                    ...fields,
                    id
                },
                type : sequelize.QueryTypes.UPDATE
            }
        );
    }

    async updateReaderTokens(options) {
        let accessSettings = await this.getAccessSettings({
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

        const accessReadersGroups = await this.getAccessReadersGroups({
            ...options,
            attributes : [ 'id' ],
            include    : [
                {
                    association : AccessReadersGroup.AssociationAccessSettings,
                    attributes  : [ 'id' ],
                    include     : [
                        {
                            association : AccessSetting.AssociationAccessSubjects,
                            include     : [ {
                                association : AccessSubject.AssociationAccessSubjectTokens,
                                attributes  : [ 'id', 'code' ]
                            } ],
                            attributes : [ 'id', 'mobileEnabled', 'virtualCode' ]
                        }
                    ]
                }
            ]
        });

        accessSettings = [
            ...accessSettings,
            ..._Flatten(accessReadersGroups.map((accessReadersGroup) => accessReadersGroup.accessSettings))
        ];

        const accessTokenReaderIds = [ this.id ];
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
            { method: [ 'stateStatus', filters.stateStatus ] },
            { method: [ 'accessReadersGroupIds', filters.accessReadersGroupIds ] },
            { method : [ 'updateDates', {
                updateStart : filters.updateStart,
                updateEnd   : filters.updateEnd
            } ] },
            { method : [ 'createDates', {
                createStart : filters.createStart,
                createEnd   : filters.createEnd
            } ] }
        ];

        const { rows, count } = await AccessTokenReader.scope(filterScopes).findAndCountAll({
            ...options,
            ...(ids) ? {} : { limit, offset },
            include : [
                {
                    association : AccessTokenReader.AssociationAccessReadersGroups,
                    attributes  : [],
                    required    : false
                }
            ],
            group      : [ 'AccessTokenReader.id' ],
            attributes : [ 'id' ],
            order      : [ [ sortedBy, order ], [ 'id', 'ASC' ] ],
            subQuery   : false,
            distinct   : true
        });

        const accessTokenReaders = rows.length ? await AccessTokenReader.findAll({
            where : {
                id : rows.map(({ id }) => id)
            },
            include : [
                {
                    association : AccessTokenReader.AssociationAccessReadersGroups,
                    required    : false
                },
                {
                    association : AccessTokenReader.AssociationSyncChanges,
                    required    : false
                }
            ],
            order : [ [ sortedBy, order ], [ 'id', 'ASC' ] ]
        }) : [];

        return { accessTokenReaders, count: count && count.length || 0 };
    }

    async getMqttCredentials() {
        const { accessToken: token, adminUser: { rootTopic }  } = await this.getWorkspace({
            include : [ Workspace.AssociationAdminUser ]
        });

        return {
            rootTopic,
            username : `reader/${rootTopic}/${this.code}`,
            password : token
        };
    }

    async hanldeCodeChanged() {
        // const { accessToken: token, name: workspaceName } = await this.getWorkspace();
        const { rootTopic, username: mqttUsername, password: mqttPassword } = await this.getMqttCredentials();
        const mqttPasswordHash = createHash(mqttPassword);
        // const { accessToken: token, name: workspaceName } = await this.getWorkspace();
        // const { accessToken: token, adminUser: { rootTopic }  } = await this.getWorkspace({
        //     include : [ Workspace.AssociationAdminUser ]
        // });

        if (this.previous('code')) {
            const previousMqttUsername = `reader/${rootTopic}/${this.previous('code')}`;

            await MqttAcl.destroy({ where: { username: previousMqttUsername } });
            await MqttUser.destroy({ where: { username: previousMqttUsername } });
        }
        // const mqttUsername = `reader/${rootTopic}/${this.code}`;
        // const mqttPasswordHash = createHash(token);

        const mqttUser = await MqttUser.create({
            username : mqttUsername,
            password : mqttPasswordHash
        });

        await MqttAcl.bulkCreate([
            {
                allow    : '1',
                ipaddr   : null,
                username : mqttUser.username,
                clientid : null,
                access   : 3,
                topic    : `${rootTopic}/sweet-home/${this.code}/#`
            },
            {
                allow    : '1',
                ipaddr   : null,
                username : mqttUser.username,
                clientid : null,
                access   : 3,
                topic    : `${rootTopic}/errors/sweet-home/${this.code}/#`
            }
        ]);
    }
}

AccessTokenReader.init({
    id             : { type: DT.BIGINT, primaryKey: true, autoIncrement: true },
    // eslint-disable-next-line max-len
    workspaceId    : { type: DT.BIGINT, allowNull: false, defaultValue: () => AccessTokenReader.getWorkspaceIdFromNamespace() }, // eslint-disable-line max-len
    name           : { type: DT.STRING, allowNull: false },
    enabled        : { type: DT.BOOLEAN, allowNull: false, defaultValue: true },
    isArchived     : { type: DT.BOOLEAN, allowNull: false, defaultValue: false },
    code           : { type: DT.STRING, allowNull: false },
    stateStatus    : { type: DT.STRING, allowNull: false, defaultValue: AccessTokenReader.STATE_INACTIVE },
    popularityCoef : { type: DT.INTEGER, allowNull: false, defaultValue: 0 },
    activeAt       : { type: DT.DATE(3), allowNull: true },
    createdAt      : { type: DT.DATE(3) },
    updatedAt      : { type: DT.DATE(3) },
    deletedAt      : { type: DT.DELETED_AT_DATE(3), allowNull: false, defaultValue: { [Op.eq]: sequelize.literal('0') } },
    resetRules     : { type: DT.BOOLEAN, allowNull: false, defaultValue: true }
}, {
    paranoid   : true,
    timestamps : true,
    deletedAt  : 'deletedAt',
    createdAt  : false,
    updatedAt  : false,
    hooks      : {
        async beforeUpdate(model) {
            if (model.changed('enabled') && model.isArchived) throw new Error('Cannot enable archived entity');
            if (model.changed('isArchived') && model.isArchived) model.enabled = false;
            if (model.changed('code')) await model.hanldeCodeChanged();

            // clear activeAt
            // if ((model.changed('enabled') || model.changed('isArchived')) && model.enabled && !model.isArchived) {
            //    model.activeAt = null;
            // }
            // check if reader became ->inactive and change state
            // because we want to use athomic operations
            // and as reader can become inactive only after changes fields enabled=false or isArchived=true
            // (so reader-> inactive only due other operations)
            // see tokenReaderManager for other status changes
            // if ((!model.enabled || model.isArchived) && model.stateStatus !== AccessTokenReader.STATE_INACTIVE) {
            //     model.stateStatus = AccessTokenReader.STATE_INACTIVE;
            // }
        },
        async beforeCreate(model) {
            if (model.enabled && model.isArchived) throw new Error('Cannot enable archived entity');
            if (model.changed('code')) await model.hanldeCodeChanged();
        },
        async beforeDestroy(model) {
            const { username: mqttUsername } = await model.getMqttCredentials();

            await MqttAcl.destroy({ where: { username: mqttUsername } });
            await MqttUser.destroy({ where: { username: mqttUsername } });
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
                                code : {
                                    [Op.like] : `%${search}%`
                                }
                            },
                            {
                                name : {
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
        },
        stateStatus(stateStatus) {
            if (stateStatus) {
                return {
                    where : { stateStatus }
                };
            }

            return {};
        },
        accessReadersGroupIds(accessReadersGroupIds = []) {
            if (accessReadersGroupIds && accessReadersGroupIds.length) {
                return {
                    where : {
                        '$accessReadersGroups.id$' : accessReadersGroupIds
                    }
                };
            }

            return {};
        }
    },
    sequelize
});

export default AccessTokenReader;
