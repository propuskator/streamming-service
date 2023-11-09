import { DataTypes as DT } from 'sequelize';
import sequelize           from '../sequelizeSingleton';
import Base                from './Base';
import User       from './User';
import AccessTokenReader   from './AccessTokenReader';

class UsersAccessTokenReadersOrder extends Base {
    static initRelations() {
        this.AssociationUser = this.belongsTo(User, { as: 'user', foreignKey: 'userId' });
        this.AssociationAccessTokenReader = this.belongsTo(AccessTokenReader, { as: 'accessTokenReader', foreignKey: 'accessTokenReaderId' });
    }
}
UsersAccessTokenReadersOrder.init({
    userId              : { type: DT.BIGINT, allowNull: false, primaryKey: true },
    accessTokenReaderId : { type: DT.BIGINT, allowNull: false, primaryKey: true },
    position            : { type: DT.BIGINT, allowNull: false, primaryKey: true }
}, {
    tableName  : 'UsersAccessTokenReadersOrders',
    timestamps : false,
    sequelize
});

export default UsersAccessTokenReadersOrder;
