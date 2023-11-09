import {
    DataTypes as DT,
    Op
} from 'sequelize';
import sequelize from '../sequelizeSingleton';
import Base from './WorkspaceModelBase';
import AccessTokenReader from './AccessTokenReader';
import AccessSubject from './AccessSubject';
import AccessSubjectToken from './AccessSubjectToken';

class AccessLog extends Base {
    static STATUS_SUCCESS = 'SUCCESS'

    static STATUS_DENIED = 'DENIED'

    static initRelations() {
        this.AssociationAccessTokenReader = this.belongsTo(AccessTokenReader, { as: 'accessTokenReader', foreignKey: 'accessTokenReaderId' });
        this.AssociationAccessSubject = this.belongsTo(AccessSubject, { as: 'accessSubject', foreignKey: 'accessSubjectId' });
        this.AssociationAccessSubjectToken = this.belongsTo(AccessSubjectToken, { as: 'accessSubjectToken', foreignKey: 'accessSubjectTokenId' });
    }

    static async findAllByParams({ ids, limit, offset, sortedBy, order, ...filters }, options = {}) {
        const filterScopes = [
            { method: [ 'ids', ids ] },
            { method: [ 'sorting', { sortedBy, order } ] },
            { method: [ 'search', filters.search ] },
            { method: [ 'tokenType', filters.tokenType ] },
            { method: [ 'status', filters.status ] },
            { method: [ 'accessSubjectTokenIds', filters.accessSubjectTokenIds ] },
            { method: [ 'accessTokenReaderIds', filters.accessTokenReaderIds ] },
            { method: [ 'accessSubjectIds', filters.accessSubjectIds ] },
            { method : [ 'createDates', {
                createStart : filters.createStart,
                createEnd   : filters.createEnd
            } ] }
        ];

        let orderToReq = null;

        if (sortedBy === 'subjectName') {
            orderToReq = [ AccessLog.AssociationAccessSubject, 'name' ];
        } else if (sortedBy === 'tokenName') {
            orderToReq = [ AccessLog.AssociationAccessSubjectToken, 'name' ];
        } else if (sortedBy === 'tokenCode') {
            orderToReq = [ AccessLog.AssociationAccessSubjectToken, 'code' ];
        } else if (sortedBy === 'readerName') {
            orderToReq = [ AccessLog.AssociationAccessTokenReader, 'name' ];
        } else {
            orderToReq = [ sortedBy ];
        }

        orderToReq.push(order);
        const { rows: accessLogs, count } = await AccessLog.scope(filterScopes).findAndCountAll({
            ...options,
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
            order    : [ orderToReq, [ 'id', 'ASC' ] ],
            subQuery : false,
            distinct : true
        });

        return { accessLogs, count };
    }
}

AccessLog.init({
    id                   : { type: DT.BIGINT, primaryKey: true, autoIncrement: true },
    // eslint-disable-next-line max-len
    workspaceId          : { type: DT.BIGINT, allowNull: false, defaultValue: () => AccessLog.getWorkspaceIdFromNamespace() },
    accessTokenReaderId  : { type: DT.BIGINT, allowNull: false },
    accessSubjectTokenId : { type: DT.BIGINT, allowNull: true },
    accessSubjectId      : { type: DT.BIGINT, allowNull: true },
    status               : { type: DT.ENUM(AccessLog.STATUS_SUCCESS, AccessLog.STATUS_DENIED), allowNull: false },
    attemptedAt          : { type: DT.DATE(3) },
    createdAt            : { type: DT.DATE(3) }
}, {
    timestamps : false,
    scopes     : {
        ids(ids) {
            if (ids) {
                return {
                    where : { id: ids }
                };
            }

            return {};
        },
        sorting({ sortedBy, order }) {
            let sorting;

            switch (sortedBy) {
                case 'status':
                    sorting = [ [ sortedBy, order ] ];
                    break;

                case 'readerName':
                    sorting = [ [ 'accessTokenReader', 'name', order ] ];
                    break;

                case 'subjectName':
                    sorting = [ [ 'accessSubject', 'name', order ] ];
                    break;

                case 'tokenType':
                    sorting = [ [ 'accessSubjectToken', 'type', order ] ];
                    break;

                case 'tokenName':
                    sorting = [ [ 'accessSubjectToken', 'name', order ] ];
                    break;

                case 'tokenCode':
                    sorting = [ [ 'accessSubjectToken', 'code', order ] ];
                    break;

                default:
                    sorting = [ [ 'createdAt', order ] ];
                    break;
            }


            return { order: sorting };
        },
        search(search) {
            if (search) {
                return {
                    where : {
                        [Op.and] : [
                            ...(this._scope && this._scope.where && this._scope.where[Op.and] || []),
                            {
                                [Op.or] : [
                                    {
                                        '$accessSubject.name$' : {
                                            [Op.like] : `%${search}%`
                                        }
                                    },
                                    {
                                        '$accessSubjectToken.name$' : {
                                            [Op.like] : `%${search}%`
                                        }
                                    }
                                ]
                            }
                        ]
                    }
                };
            }

            return {};
        },
        createDates({ createStart, createEnd }) {
            return {
                where : (createStart || createEnd) ? {
                    createdAt : {
                        ...(createStart ? { [Op.gte]: createStart } : null),
                        ...(createEnd ? { [Op.lte]: createEnd } : null)
                    }
                } : {}
            };
        },
        status(status) {
            if (status) {
                return {
                    where : { status }
                };
            }

            return {};
        },
        accessSubjectTokenIds(accessSubjectTokenIds) {
            if (accessSubjectTokenIds) {
                return {
                    where : { accessSubjectTokenId: accessSubjectTokenIds }
                };
            }

            return {};
        },
        accessTokenReaderIds(accessTokenReaderIds) {
            if (accessTokenReaderIds) {
                return {
                    where : { accessTokenReaderId: accessTokenReaderIds }
                };
            }

            return {};
        },
        accessSubjectIds(accessSubjectIds) {
            if (accessSubjectIds) {
                return {
                    where : { accessSubjectId: accessSubjectIds }
                };
            }

            return {};
        },
        tokenType(tokenType) {
            if (tokenType === 'mobile') {
                return {
                    where : {
                        'accessSubjectId'      : { [Op.not]: null },
                        'accessSubjectTokenId' : null
                    }
                };
            } else if (tokenType === 'notMobile') {
                return {
                    where : {
                        [Op.and] : [
                            ...(this._scope && this._scope.where && this._scope.where[Op.and] || []),
                            { [Op.or] : [
                                { 'accessSubjectId': null },
                                { 'accessSubjectTokenId': { [Op.not]: null } }
                            ] }
                        ]
                    }
                };
            }
            // if (tokenType) {
            //     return {
            //         where : {
            //             '$accessSubjectToken.type$' : tokenType
            //         }
            //     };
            // }

            return {};
        }
    },
    sequelize
});

export default AccessLog;
