import { DataTypes as DT } from 'sequelize';
import Base                    from '../Base';
import sequelize               from '../../sequelizeSingleton';
import AccessReadersGroup      from '../AccessReadersGroup';
import AccessTokenReader       from '../AccessTokenReader';


class GroupToReaderMap extends Base {
    static initRelations() {
        this.AssociationAccessReadersGroup = this.belongsTo(AccessReadersGroup, { as: 'accessReadersGroup', foreignKey: 'accessReadersGroupId' });
        this.AssociationAccessTokenReader = this.belongsTo(AccessTokenReader, { as: 'accessTokenReader', foreignKey: 'accessTokenReaderId' });
    }
}
GroupToReaderMap.init({
    accessReadersGroupId : { type: DT.BIGINT, allowNull: false, primaryKey: true },
    accessTokenReaderId  : { type: DT.BIGINT, allowNull: false, primaryKey: true },
    createdAt            : { type: DT.DATE(3) }
}, {
    tableName  : 'GroupToReaderMap',
    timestamps : false,
    sequelize
});

export default GroupToReaderMap;
