import path                from 'path';
import { DataTypes as DT } from 'sequelize';
import uuidv4              from 'uuid/v4';
import fse                 from 'fs-extra';
import bcrypt              from 'bcryptjs';
import { nanoid } from 'nanoid';
import { staticPath }      from '../config';
import sequelize           from '../sequelizeSingleton';
import Base                from './Base';
import Workspace from './Workspace';
import MqttUser from './MqttUser';
import MqttAcl from './MqttAcl';
import { createHash } from './utils';


const SALT_ROUNDS = 2;

function hashPassword(password) {
    const salt = bcrypt.genSaltSync(SALT_ROUNDS); // eslint-disable-line no-sync

    return bcrypt.hashSync(password, salt); // eslint-disable-line no-sync
}

class AdminUser extends Base {
    static initRelations() {
        this.AssociationWorkspace = this.belongsTo(Workspace, { as: 'workspace', foreignKey: 'workspaceId' });
    }

    async checkPassword(plain) {
        return bcrypt.compare(plain, this.passwordHash);
    }

    async setAvatarImage(file, options) {
        if (this.avatar) await this.deleteAvatarImage(options);

        const ext = path.extname(file.originalname).toLowerCase();
        const filename = `${uuidv4() + ext}`;

        await this.update({ avatar: filename }, options);

        await fse.writeFile(`${staticPath}/admin-users/${filename}`, file.buffer);
    }

    async getMqttCredentials() {
        return {
            rootTopic : this.rootTopic,
            username  : `client/${this.login}`,
            password  : this.mqttToken
        };
    }

    async deleteAvatarImage(options) {
        if (!this.avatar) return;

        try {
            await fse.unlink(`${staticPath}/admin-users/${this.avatar}`);
        } catch (e) {
            if (e.code !== 'ENOENT') throw e; // case if file doesnt exist
        }

        await this.update({ avatar: null }, options);
    }

    async hanldeCredentialsChanged() {
        // eslint-disable-next-line max-len
        // const workspace = (this.workspace && this.workspace.id === this.workspaceId) ? this.workspace : await Workspace.findByPk(this.workspaceId);

        let mqttUser = null;

        if (this.previous('login')) {
            const previousMqttUsername = `client/${this.previous('login')}`;

            await MqttAcl.destroy({ where: { username: previousMqttUsername } });
            mqttUser = await MqttUser.findOne({ where: { username: previousMqttUsername } });
        }

        if (!mqttUser) mqttUser = MqttUser.build();

        this.set({ mqttToken: nanoid(24) });

        if (this.changed('login') || !mqttUser.username) mqttUser.setDataValue('username', `client/${this.login}`);
        mqttUser.setDataValue('password', createHash(this.mqttToken));


        await mqttUser.save();

        await MqttAcl.bulkCreate([
            {
                allow    : '1',
                ipaddr   : null,
                username : mqttUser.username,
                clientid : null,
                access   : 3,
                topic    : `${this.rootTopic}/#`
            }
        ]);
    }
}
AdminUser.init({
    id           : { type: DT.BIGINT, primaryKey: true, autoIncrement: true },
    workspaceId  : { type: DT.BIGINT },
    login        : { type: DT.STRING, allowNull: false },
    // email        : { type: DT.STRING, allowNull: false },
    avatar       : { type: DT.STRING, allowNull: true },
    passwordHash : { type: DT.STRING },
    mqttToken    : { type: DT.STRING },
    createdAt    : { type: DT.DATE(3) },
    updatedAt    : { type: DT.DATE(3) },
    password     : { type : DT.VIRTUAL,
        set(password) {
            this.setDataValue('passwordHash', hashPassword(password));
        } },
    rootTopic : { type : DT.VIRTUAL,
        get() {
            return createHash(this.getDataValue('login'));
        } }
}, {
    timestamps : false,
    hooks      : {
        async beforeSave(model) {
            if (model.changed('login') || model.changed('password') || model.changed('passwordHash') || model.changed('workspaceId')) await model.hanldeCredentialsChanged();
        },
        async beforeDestroy(model) {
            const { username: mqttUsername } = await model.getMqttCredentials();

            await MqttAcl.destroy({ where: { username: mqttUsername } });
            await MqttUser.destroy({ where: { username: mqttUsername } });
        }
    },
    sequelize
});

export default AdminUser;
