// import handlebars from 'handlebars';
import { DataTypes as DT, Op } from 'sequelize';
import sequelize from '../sequelizeSingleton';
import Base from './WorkspaceModelBase';
import AccessSubject from './AccessSubject';
import AccessSubjectToken from './AccessSubjectToken';
import AccessTokenReader from './AccessTokenReader';

class Notification extends Base {
    static TYPE_UNAUTH_SUBJECT_ACCESS = 'UNAUTH_SUBJECT_ACCESS'

    static TYPE_UNAUTH_ACCESS = 'UNAUTH_ACCESS'

    static TYPE_UNKNOWN_TOKEN = 'UNKNOWN_TOKEN'

    static TYPE_NEW_READER = 'NEW_READER'

    static TYPE_INACTIVE_READER = 'INACTIVE_READER'

    static TYPE_ACTIVE_READER = 'ACTIVE_READER'

    /* !!! currently unsed. Move to appropriate place
    static MESSAGE_TEMPLATE_BY_TYPE  = {
        [this.TYPE_UNAUTH_ACCESS]   : '{{subjectFullName}} совершил несанкционированый доступ в {{readerName}}',
        [this.TYPE_NEW_READER]      : 'Новый считыватель {{readerCode}} появился в системе',
        [this.TYPE_INACTIVE_READER] : 'Считыватель {{readerCode}} перестал отвечать'
    }

    static getMessage(type, data) {
        const template = this.MESSAGE_TEMPLATE_BY_TYPE[type];

        if (!template) throw new Error('No template found');

        const message = handlebars.compile(template);

        return message(data);
    }*/

    static initRelations() {
        super.initRelations();
        this.AssociationAccessSubject = this.belongsTo(AccessSubject, { as: 'accessSubject', foreignKey: 'accessSubjectId' });
        this.AssociationAccessSubjectToken = this.belongsTo(AccessSubjectToken, { as: 'accessSubjectToken', foreignKey: 'accessSubjectTokenId' });
        this.AssociationAccessTokenReader = this.belongsTo(AccessTokenReader, { as: 'accessTokenReader', foreignKey: 'accessTokenReaderId' });
    }

    static async findAllByParams({ ids, limit, offset, sortedBy, order, ...filters }, options = {}) {
        const filterScopes = [
            { method: [ 'ids', ids ] },
            { method: [ 'isRead', filters.isRead ] },
            { method: [ 'lastWeek' ] },
            { method : [ 'updateDates', {
                updateStart : filters.updateStart,
                updateEnd   : filters.updateEnd
            } ] },
            { method : [ 'createDates', {
                createStart : filters.createStart,
                createEnd   : filters.createEnd
            } ] }
        ];
        const orderArr = [ [ 'id', 'DESC' ] ];

        if (sortedBy && order) orderArr.unshift([ sortedBy, order ]);

        const { rows: notifications, count } = await Notification.scope(filterScopes).findAndCountAll({
            order   : orderArr,
            ...(ids) ? {} : { limit, offset },
            include : [
                {
                    association : this.AssociationAccessTokenReader,
                    required    : false,
                    paranoid    : false
                },
                {
                    association : this.AssociationAccessSubject,
                    required    : false,
                    paranoid    : false
                },
                {
                    association : this.AssociationAccessSubjectToken,
                    required    : false,
                    paranoid    : false
                }
            ],
            subQuery : false,
            distinct : true
        }, options);

        return { notifications, count };
    }
}
Notification.init({
    id                   : { type: DT.BIGINT, primaryKey: true, autoIncrement: true },
    // eslint-disable-next-line max-len
    workspaceId          : { type: DT.BIGINT, allowNull: false, defaultValue: () => Notification.getWorkspaceIdFromNamespace() },
    accessSubjectTokenId : { type: DT.BIGINT, allowNull: true },
    accessSubjectId      : { type: DT.BIGINT, allowNull: true },
    accessTokenReaderId  : { type: DT.BIGINT, allowNull: true },
    data                 : { type: DT.JSON, allowNull: true },
    type                 : { type: DT.STRING, allowNull: false },
    message              : { type: DT.STRING, allowNull: false },
    isRead               : { type: DT.BOOLEAN, allowNull: false, defaultValue: false },
    createdAt            : { type: DT.DATE(3) },
    updatedAt            : { type: DT.DATE(3) }
}, {
    timestamps : false,
    scopes     : {
        workspace(workspaceId) {
            return { where: { workspaceId } };
        },
        ids(ids) {
            if (ids) {
                return {
                    where : {
                        [Op.and] : [
                            ...(this._scope && this._scope.where && this._scope.where[Op.and] || []),
                            {
                                id : ids
                            }
                        ]
                    }
                };
            }

            return {};
        },
        isRead(isRead) {
            if (typeof isRead === 'boolean') {
                return {
                    where : {
                        [Op.and] : [
                            ...(this._scope && this._scope.where && this._scope.where[Op.and] || []),
                            {
                                isRead
                            }
                        ]
                    }
                };
            }

            return {};
        },
        lastWeek() {
            return {
                where : {
                    [Op.and] : [
                        ...(this._scope && this._scope.where && this._scope.where[Op.and] || []),
                        {
                            createdAt : {
                                [Op.gte] : new Date().setDate(new Date().getDate() - 7)
                            }
                        }
                    ]
                }
            };
        },
        updateDates({ updateStart, updateEnd }) {
            if (updateStart || updateEnd) {
                return {
                    where : {
                        [Op.and] : [
                            ...(this._scope && this._scope.where && this._scope.where[Op.and] || []),
                            {
                                updatedAt : {
                                    ...(updateStart ? { [Op.gte]: updateStart } : {}),
                                    ...(updateEnd ? { [Op.lte]: updateEnd } : {})
                                }
                            }
                        ]
                    }
                };
            }

            return {};
        },
        createDates({ createStart, createEnd }) {
            if (createStart || createEnd) {
                return {
                    where : {
                        [Op.and] : [
                            ...(this._scope && this._scope.where && this._scope.where[Op.and] || []),
                            {
                                createdAt : {
                                    ...(createStart ? { [Op.gte]: createStart } : {}),
                                    ...(createEnd ? { [Op.lte]: createEnd } : {})
                                }
                            }
                        ]
                    }
                };
            }

            return {};
        }
    },
    sequelize
});

export default Notification;
