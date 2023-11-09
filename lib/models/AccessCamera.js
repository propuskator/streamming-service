/* eslint-disable no-param-reassign */
import { DataTypes as DT, Op } from 'sequelize';
import sequelize     from '../sequelizeSingleton';
import Base          from './WorkspaceModelBase';
import AccessTokenReader from './AccessTokenReader';
import CameraToReaderMap from './mappings/CameraToReaderMap';

class AccessCamera extends Base {
    static initRelations() {
        super.initRelations();
        this.AssociationAccessTokenReaders = this.belongsToMany(AccessTokenReader, { through: CameraToReaderMap, as: 'accessTokenReaders', foreignKey: 'accessCameraId', otherKey: 'accessTokenReaderId' });
        this.AssociationCameraToReaderMap = this.hasMany(CameraToReaderMap, { as: 'cameraToReaderMap', foreignKey: 'accessCameraId' });
    }

    static async findAllByParams({ ids, limit, offset, sortedBy, order, ...filters }, options = {}) {
        const filterScopes = [
            { method: [ 'ids', ids ] },
            { method: [ 'enabled', filters.enabled ] },
            { method: [ 'isArchived', filters.isArchived ] },
            { method: [ 'search', filters.search ] },
            { method : [ 'updateDates', {
                updateStart : filters.updateStart,
                updateEnd   : filters.updateEnd
            } ] },
            { method : [ 'createDates', {
                createStart : filters.createStart,
                createEnd   : filters.createEnd
            } ] }
        ];

        const { rows: accessCameras, count } = await AccessCamera.scope(filterScopes).findAndCountAll({
            ...options,
            ...(ids) ? {} : { limit, offset },
            order    : [ [ sortedBy, order ], [ 'id', 'ASC' ] ],
            include  : [ { association: AccessCamera.AssociationAccessTokenReaders, required: false } ],
            subQuery : false
        });

        return { accessCameras, count };
    }
}

AccessCamera.init({
    id                  : { type: DT.BIGINT, primaryKey: true, autoIncrement: true },
    // eslint-disable-next-line max-len
    workspaceId         : { type: DT.BIGINT, allowNull: false, defaultValue: () => AccessCamera.getWorkspaceIdFromNamespace() },
    name                : { type: DT.STRING, allowNull: false },
    enabled             : { type: DT.BOOLEAN, allowNull: false, defaultValue: true },
    isArchived          : { type: DT.BOOLEAN, allowNull: false, defaultValue: false },
    rtspUrl             : { type: DT.STRING(2082), allowNull: false },
    lastSuccessStreamAt : { type: DT.DATE(3), allowNull: true },
    lastAttemptAt       : { type: DT.DATE(3), allowNull: true },
    createdAt           : { type: DT.DATE(3) },
    updatedAt           : { type: DT.DATE(3) },
    deletedAt           : { type: DT.DELETED_AT_DATE(3), allowNull: false, defaultValue: { [Op.eq]: sequelize.literal('0') } }
}, {
    paranoid   : true,
    timestamps : true,
    deletedAt  : 'deletedAt',
    createdAt  : false,
    updatedAt  : false,
    hooks      : {
        beforeUpdate : async (model) => {
            if (model.changed('enabled') && model.isArchived) throw new Error('Cannot enable archived entity');
            if (model.changed('isArchived') && model.isArchived) model.enabled = false;
        },
        beforeCreate : async (model) => {
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
        }
    },
    sequelize
});

export default AccessCamera;
