/* eslint-disable no-param-reassign */
export default class DX extends Error {
    constructor(args) {
        // eslint-disable-next-line no-param-reassign
        if (typeof args === 'string') args = { message: args };
        args = args || {};
        super();
        this.type = args.type || 'unknownError';
        this.message = args.message || 'Please, contact your system administrator!';
    }
}

export class NotFoundError extends DX {
    constructor(args) {
        super({
            message : `Cannot find ${args.modelName} by primary key '${args.primaryKey}'`,
            ...args,
            type    : 'notFound'
        });
        this.primaryKey = args.primaryKey;
        this.modelName = args.modelName;
    }
}

export class ForeignKeyConstraintError extends DX {
    constructor(args) {
        super({
            message : `Foreign key constraint error. Fields ${args.fields.join(', ')}. Model: ${args.modelName}`,
            ...args,
            type    : 'foreignKeyConstraint'
        });
        this.fields = args.fields;// array
        this.modelName = args.modelName;
    }
}

export class UniqueConstraintError extends DX {
    constructor(args) {
        super({
            message : `Unique constraint error. Fields ${Object.entries(args.fields).map(([ k, v ]) => `${k}='${v}'`).join(', ')}. Model: ${args.modelName}`,
            ...args,
            type    : 'uniqueConstraint'
        });
        this.fields = args.fields;// object
        this.modelName = args.modelName;
    }
}
export class TimeoutError extends DX {
    constructor(args) {
        if (typeof args === 'string') args = { message: args };
        args = args || {};
        super({ message: 'Timed out', ...args, type: 'timeout' });
        this.data = args.data || null;
    }
}

export class OpenDoorError extends DX {
    constructor(args) {
        if (typeof args === 'string') args = { message: args };
        args = args || {};
        super({ message: 'Open door error', ...args, type: 'openDoorError' });
        this.code = args.code;
        this.data = args.data || null;
    }
}

DX.NotFoundError = NotFoundError;
DX.ForeignKeyConstraintError = ForeignKeyConstraintError;
DX.UniqueConstraintError = UniqueConstraintError;
DX.TimeoutError = TimeoutError;
DX.OpenDoorError = OpenDoorError;
