import Actions, { Action } from './actions';

describe('Actions', () => {
  describe('contains', () => {
    test('should determine if a resource contains a given action', () => {
      const resource1 = {
        _actions: [Actions.ManageAssignments],
      };
      expect(Actions.contains(resource1, Actions.ManageAssignments)).toBeTruthy();

      const resource2 = {
        _actions: [],
      };
      expect(Actions.contains(resource2, Actions.ManageAssignments)).toBeFalsy();

      const resource3 = {};
      expect(Actions.contains(resource3, Actions.ManageAssignments)).toBeFalsy();
    });
  });

  describe('merge', () => {
    test('should merge a value object with the path template of an Action', () => {
      const values = {
        bar: 'BAR',
        foo: 'FOO',
        zoo: 'ZOO',
      };

      const action: Action = {
        actionName: 'FOO',
        method: 'GET',
        path: '/somepath/${foo}/suffix/${bar}',
      };

      const expected = `/somepath/${values.foo}/suffix/${values.bar}`;

      const actual = Actions.merge(action, values);
      expect(actual.path).toEqual(expected);
      expect(actual.path).not.toContain(values.zoo);
    });
  });
});
