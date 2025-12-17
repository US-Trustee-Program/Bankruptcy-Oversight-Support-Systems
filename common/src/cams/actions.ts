export type Action = {
  actionName: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
};

export type ResourceActions<T> = T & {
  _actions?: Action[];
};

function contains(resource: ResourceActions<object>, action: Action) {
  if (!resource._actions) return false;
  return !!resource._actions.find((resourceAction) => {
    return resourceAction.actionName === action.actionName;
  });
}

function merge<T extends Record<string, unknown>>(action: Action, values: T) {
  // Extract only the string properties needed for path templating
  const mergeAction = { ...action };
  let template = mergeAction.path;
  Object.keys(values).forEach((key) => {
    const value = values[key];
    if (typeof value === 'string') {
      const token = '${' + key + '}';
      template = template.replace(token, value);
    }
  });
  mergeAction.path = template;
  return mergeAction;
}

const ManageAssignments: Action = {
  actionName: 'manage assignments',
  method: 'POST',
  path: '/case-assignments/${caseId}',
};

const EditNote: Action = {
  actionName: 'edit note',
  method: 'PUT',
  path: '/cases/${caseId}/notes/${id}',
};

const RemoveNote: Action = {
  actionName: 'remove note',
  method: 'DELETE',
  path: '/cases/${caseId}/notes/${id}',
};

const Actions = {
  ManageAssignments,
  EditNote,
  RemoveNote,
  contains,
  merge,
} as const;

export default Actions;
