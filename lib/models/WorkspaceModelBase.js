/* eslint-disable more/no-duplicated-chains */
/* eslint-disable no-param-reassign */
import cls              from '../cls';
import Base from './Base';
import Workspace from './Workspace';

export default class WorkspaceModelBase extends Base {
    static initRelations() {
        this.AssociationWorkspace = this.belongsTo(Workspace, { as: 'workspace', foreignKey: 'workspaceId' });
    }

    static getWorkspaceIdFromNamespace() {
        return cls.get('workspaceId');
    }

    static _injectScope(options) {
        super._injectScope(options);
        options.where = options.where || {};
        const workspaceId = this.getWorkspaceIdFromNamespace();

        if (options.where.workspaceId === undefined && workspaceId) {
            options.where.workspaceId = workspaceId;
        }
    }
}
