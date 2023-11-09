import { DataTypes as DT } from 'sequelize';
import bcrypt              from 'bcryptjs';
import { nanoid } from 'nanoid';
import sequelize           from '../sequelizeSingleton';
import Base                from './Base';
import Workspace from './Workspace';
import AdminUser from './AdminUser';
import MqttUser from './MqttUser';
import MqttAcl from './MqttAcl';
import UsersAccessTokenReadersOrder from './UsersAccessTokenReadersOrder';
import { createHash } from './utils';


const SALT_ROUNDS = 2;

function hashPassword(password) {
    const salt = bcrypt.genSaltSync(SALT_ROUNDS); // eslint-disable-line no-sync

    return bcrypt.hashSync(password, salt); // eslint-disable-line no-sync
}

class User extends Base {
    static initRelations() {
        this.AssociationWorkspace = this.belongsTo(Workspace, { as: 'workspace', foreignKey: 'workspaceId' });
    }

    async checkPassword(plain) {
        return bcrypt.compare(plain, this.passwordHash);
    }

    async getMqttCredentials() {
        const { rootTopic } = await AdminUser.findOne({ where: { workspaceId: this.workspaceId } });

        return {
            rootTopic,
            username : `user/${this.workspaceId}/${this.email}`,
            password : this.mqttToken
        };
    }

    async hanldeCredentialsChanged() {
        // eslint-disable-next-line max-len
        // const workspace = (this.workspace && this.workspace.id === this.workspaceId) ? this.workspace : await Workspace.findByPk(this.workspaceId);
        const { rootTopic } = await AdminUser.findOne({ where: { workspaceId: this.workspaceId } });

        let mqttUser = null;

        if (this.previous('email')) {
            const previousMqttUsername = `user/${this.workspaceId}/${this.previous('email')}`;

            await MqttAcl.destroy({ where: { username: previousMqttUsername } });
            mqttUser = await MqttUser.findOne({ where: { username: previousMqttUsername } });
        }

        if (!mqttUser) mqttUser = MqttUser.build();

        this.set({ mqttToken: nanoid(24) });

        if (this.changed('email') || !mqttUser.username) mqttUser.setDataValue('username', `user/${this.workspaceId}/${this.email}`);
        mqttUser.setDataValue('password', createHash(this.mqttToken));


        await mqttUser.save();

        await MqttAcl.bulkCreate([
            {
                allow    : '1',
                ipaddr   : null,
                username : mqttUser.username,
                clientid : null,
                access   : 3,
                topic    : `${rootTopic}/#`
            }
        ]);
    }
}
User.init({
    id           : { type: DT.BIGINT, primaryKey: true, autoIncrement: true },
    workspaceId  : { type: DT.BIGINT, allowNull: false },
    // login          : { type: DT.STRING, allowNull: false },
    email        : { type: DT.STRING, allowNull: false },
    // accessTokenReadersOrder : { type: DT.JSON, allowNull: true },
    passwordHash : { type: DT.STRING, allowNull: false },
    mqttToken    : { type: DT.STRING },
    createdAt    : { type: DT.DATE(3) },
    updatedAt    : { type: DT.DATE(3) },
    password     : { type : DT.VIRTUAL,
        set(password) {
            this.setDataValue('passwordHash', hashPassword(password));
        } }
}, {
    timestamps : false,
    hooks      : {
        async beforeSave(model) {
            if (model.changed('email') || model.changed('password') || model.changed('passwordHash') || model.changed('workspaceId')) await model.hanldeCredentialsChanged();
        },
        async beforeDestroy(model) {
            const { username: mqttUsername } = await model.getMqttCredentials();

            await MqttAcl.destroy({ where: { username: mqttUsername } });
            await MqttUser.destroy({ where: { username: mqttUsername } });
            await UsersAccessTokenReadersOrder.destroy({ where: { userId: model.id } });
        }
    },
    sequelize
});

export default User;
