import { DataTypes as DT } from 'sequelize';
import Base                    from '../Base';
import sequelize               from '../../sequelizeSingleton';
import AccessCamera            from '../AccessCamera';
import AccessTokenReader       from '../AccessTokenReader';


class CameraToReaderMap extends Base {
    static initRelations() {
        this.AssociationAccessAccessCamera = this.belongsTo(AccessCamera, { as: 'accessCamera', foreignKey: 'accessCameraId' });
        this.AssociationAccessTokenReader = this.belongsTo(AccessTokenReader, { as: 'accessTokenReader', foreignKey: 'accessTokenReaderId' });
    }
}
CameraToReaderMap.init({
    accessCameraId      : { type: DT.BIGINT, allowNull: false, primaryKey: true },
    accessTokenReaderId : { type: DT.BIGINT, allowNull: false, primaryKey: true },
    createdAt           : { type: DT.DATE(3) }
}, {
    tableName  : 'CameraToReaderMap',
    timestamps : false,
    sequelize
});

export default CameraToReaderMap;
