import Sequelize, { DataTypes as DT } from 'sequelize';


export class DELETED_AT_DATE extends DT.DATE {
    _stringify(value) {
        return value instanceof Date ? 'CURRENT_TIMESTAMP(3)' : '0';
    }

    escape = false;
}

DELETED_AT_DATE.prototype.key = DELETED_AT_DATE.key = 'DELETED_AT_DATE';
function classToInvokable(Class) {
    return new Proxy(Class, {
        apply(Target, thisArg, args) {
            return new Target(...args);
        },
        construct(Target, args) {
            return new Target(...args);
        },
        get(target, p) {
            return target[p];
        }
    });
}

Sequelize.DELETED_AT_DATE = DT.DELETED_AT_DATE = classToInvokable(DELETED_AT_DATE);

