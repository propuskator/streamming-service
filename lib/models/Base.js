/* eslint-disable more/no-duplicated-chains */
import Sequelize, {
    UniqueConstraintError as SequelizeUniqueConstraintError,
    ForeignKeyConstraintError as SequelizeForeignKeyConstraintError
} from 'sequelize';
import { NotFoundError, ForeignKeyConstraintError, UniqueConstraintError } from './utils/DX';
import { getId, getIds } from './utils';


class Base extends Sequelize.Model {
    static initRelationsAndHooks() {
        if (this.initRelations) this.initRelations();
        if (this.initHooks) this.initHooks();
    }

    static async findByPkOrFail(primaryKey) {
        const entity = await this.findByPk(...arguments);

        if (!entity) {
            throw new NotFoundError({
                modelName : this.options.name.singular,
                primaryKey
            });
        }

        return entity;
    }

    static async bulkDelete() {
        try {
            return await super.bulkDelete(...arguments);
        } catch (e) {
            this.handleError(e);
        }
    }

    static async bulkInsert() {
        try {
            return await super.bulkInsert(...arguments);
        } catch (e) {
            this.handleError(e);
        }
    }

    static async bulkUpdate() {
        try {
            return await super.bulkUpdate(...arguments);
        } catch (e) {
            this.handleError(e);
        }
    }

    static async bulkCreate(data = [], ...args) {
        try {
            const ids = getIds(data.length);
            const dataWithIds = data.map((item, index) => ({ id: ids[index], ...item }));

            return await super.bulkCreate(dataWithIds, ...args);
        } catch (e) {
            this.handleError(e);
        }
    }

    static async destroy() {
        try {
            return await super.destroy(...arguments);
        } catch (e) {
            this.handleError(e);
        }
    }

    static async create(data  = {}, ...args) {
        try {
            const id = getId();

            const result = await super.create({ id, ...data }, ...args);

            return result;
        } catch (e) {
            this.handleError(e);
        }
    }

    async update() {
        try {
            const result = await super.update(...arguments);

            return result;
        } catch (e) {
            this.constructor.handleError(e);
        }
    }

    async save() {
        try {
            const result = await super.save(...arguments);

            return result;
        } catch (e) {
            this.constructor.handleError(e);
        }
    }

    async destroy() {
        try {
            const result = await super.destroy(...arguments);

            return result;
        } catch (e) {
            this.constructor.handleError(e);
        }
    }

    static handleError(e) {
        console.log(e);
        if (e instanceof SequelizeForeignKeyConstraintError) {
            throw new ForeignKeyConstraintError({
                modelName : this.options.name.singular,
                fields    : e.fields
            });
        } else if (e instanceof SequelizeUniqueConstraintError) {
            throw new UniqueConstraintError({
                modelName : this.options.name.singular,
                fields    : e.fields
            });
        } else throw e;
    }
}

export default Base;
