import { DataTypes as DT } from 'sequelize';
import sequelize               from '../sequelizeSingleton';
import Base                    from './Base';
import AccessTokenReader       from './AccessTokenReader';


class AccessTokenToReaderChangesMap extends Base {
    static initRelations() {
        this.AssociationAccessTokenReader = this.belongsTo(AccessTokenReader, { as: 'accessTokenReader', foreignKey: 'accessTokenReaderId' });
    }

    static async addUpdates({ accessTokenReaderIds, accessSubjectTokenCodes }, options) {
        const tokenToReaderChanges = [];

        for (const accessSubjectTokenCode of accessSubjectTokenCodes) {
            for (const accessTokenReaderId of accessTokenReaderIds) {
                tokenToReaderChanges.push({ accessSubjectTokenCode, accessTokenReaderId });
            }
        }

        if (tokenToReaderChanges.length) {
            await AccessTokenToReaderChangesMap.bulkCreate(tokenToReaderChanges, {
                ...options,
                updateOnDuplicate : [ 'updatedAt' ]
            });
        }
    }
}
AccessTokenToReaderChangesMap.init({
    accessSubjectTokenCode : { type: DT.STRING, allowNull: false, primaryKey: true },
    accessTokenReaderId    : { type: DT.BIGINT, allowNull: false, primaryKey: true },
    createdAt              : { type: DT.DATE(3) },
    updatedAt              : { type: DT.DATE(3) }
}, {
    tableName  : 'AccessTokenToReaderChangesMap',
    timestamps : false,
    sequelize
});

export default AccessTokenToReaderChangesMap;
