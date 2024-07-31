export type Action = {
  actionName: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
};

export type ResourceActions<T> = T & {
  _actions?: Action[];
};

function contains(resource: ResourceActions<object>, action: Action) {
  console.log(resource._actions);
  console.log(action);
  if (!resource._actions) return false;
  return !!resource._actions.find((resourceAction) => {
    return resourceAction.actionName === action.actionName;
  });
}

function merge(action: Action, values: object) {
  const mergeAction = { ...action };
  let template = mergeAction.path;
  Object.keys(values).forEach((key) => {
    const token = '${' + key + '}';
    template = template.replace(token, values[key]);
  });
  mergeAction.path = template;
  return mergeAction;
}

const ManageAssignments: Action = {
  actionName: 'manage assignments',
  method: 'POST',
  path: '/case-assignments/${caseId}',
};

export const Actions = {
  ManageAssignments,
  contains,
  merge,
} as const;

export default Actions;
