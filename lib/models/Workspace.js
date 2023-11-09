import { DataTypes as DT } from 'sequelize';
import { nanoid } from 'nanoid';
import sequelize from '../sequelizeSingleton';
import { apiTokenLength } from '../../lib/config';
import { configurableTypes as notificationTypes } from '../constants/notificationTypes';
import Base from './Base';
import MqttUser from './MqttUser';
import AdminUser from './AdminUser';
import { createHash } from './utils';

class Workspace extends Base {
    static initRelations() {
        this.AssociationAdminUser = this.hasOne(AdminUser, { as: 'adminUser', foreignKey: 'workspaceId' });
    }

    static NOTIFICATION_DELIMITER = '/'

    static notificationTypesToString = (typesList) => {
        return typesList.join(this.NOTIFICATION_DELIMITER);
    }

    static notificationTypesToArray = (typesListStr) => {
        if (!typesListStr.length) return [];

        return typesListStr.split(this.NOTIFICATION_DELIMITER);
    }

    static getAllowedNotificationTypes = async (workspaceId) => {
        const { notificationTypes: allowedNotificationTypes } = await Workspace.findByPkOrFail(workspaceId);

        return this.notificationTypesToArray(allowedNotificationTypes);
    }
}
Workspace.init({
    id                : { type: DT.BIGINT, primaryKey: true, autoIncrement: true },
    name              : { type: DT.STRING, allowNull: false, unique: true },
    accessToken       : { type: DT.STRING, allowNull: false, unique: true, defaultValue: () => nanoid(apiTokenLength) },
    createdAt         : { type: DT.DATE(3) },
    updatedAt         : { type: DT.DATE(3) },
    timezone          : { type: DT.STRING, allowNull: false, defaultValue: '(UTC) Coordinated Universal Time' },
    notificationTypes : {
        type         : DT.STRING,
        allowNull    : false,
        defaultValue : Workspace.notificationTypesToString(Object.keys(notificationTypes))
    }
}, {
    timestamps : false,
    sequelize,
    hooks      : {
        afterSave : async (model) => {
            if (model.changed('accessToken')) {
                // refresh mqtt credentials for readers
                const { rootTopic } = await model.getAdminUser();

                await MqttUser.update({
                    password : createHash(model.accessToken)
                }, {
                    where : {
                        username : { [sequelize.Op.like]: `reader/${rootTopic}/%` }
                    }
                });
            }
        }
    }
});

export default Workspace;
