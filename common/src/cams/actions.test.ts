import Actions, { Action } from './actions';

describe('Actions', () => {
  describe('contains', () => {
    test('should return true when _actions contains the given action', () => {
      const resource = {
        _actions: [Actions.ManageAssignments],
      };
      expect(Actions.contains(resource, Actions.ManageAssignments)).toBe(true);
    });

    test('should return false when _actions is empty', () => {
      const resource = {
        _actions: [],
      };
      expect(Actions.contains(resource, Actions.ManageAssignments)).toBe(false);
    });

    test('should return false when _actions is absent', () => {
      const resource = {};
      expect(Actions.contains(resource, Actions.ManageAssignments)).toBe(false);
    });

    test('should return false when _actions contains a different action', () => {
      const resource = {
        _actions: [Actions.EditNote],
      };
      expect(Actions.contains(resource, Actions.ManageAssignments)).toBe(false);
    });
  });

  describe('Action constants', () => {
    test('ManageAssignments should have correct actionName, method, and path', () => {
      expect(Actions.ManageAssignments.actionName).toBe('manage assignments');
      expect(Actions.ManageAssignments.method).toBe('POST');
      expect(Actions.ManageAssignments.path).toBe('/case-assignments/${caseId}');
    });

    test('EditNote should have correct actionName, method, and path', () => {
      expect(Actions.EditNote.actionName).toBe('edit note');
      expect(Actions.EditNote.method).toBe('PUT');
      expect(Actions.EditNote.path).toBe('/cases/${caseId}/notes/${id}');
    });

    test('RemoveNote should have correct actionName, method, and path', () => {
      expect(Actions.RemoveNote.actionName).toBe('remove note');
      expect(Actions.RemoveNote.method).toBe('DELETE');
      expect(Actions.RemoveNote.path).toBe('/cases/${caseId}/notes/${id}');
    });

    test('EditTrusteeNote should have correct actionName, method, and path', () => {
      expect(Actions.EditTrusteeNote.actionName).toBe('edit trustee note');
      expect(Actions.EditTrusteeNote.method).toBe('PUT');
      expect(Actions.EditTrusteeNote.path).toBe('/trustees/${trusteeId}/notes/${id}');
    });

    test('RemoveTrusteeNote should have correct actionName, method, and path', () => {
      expect(Actions.RemoveTrusteeNote.actionName).toBe('remove trustee note');
      expect(Actions.RemoveTrusteeNote.method).toBe('DELETE');
      expect(Actions.RemoveTrusteeNote.path).toBe('/trustees/${trusteeId}/notes/${id}');
    });
  });

  describe('merge', () => {
    test('should merge a value object with the path template of an Action', () => {
      const values = {
        foo: 'FOO',
        bar: 'BAR',
        zoo: 'ZOO',
      };

      const action: Action = {
        actionName: 'FOO',
        method: 'GET',
        path: '/somepath/${foo}/suffix/${bar}',
      };

      const originalPath = action.path;
      const expected = `/somepath/${values.foo}/suffix/${values.bar}`;

      const actual = Actions.merge(action, values);
      expect(actual.path).toEqual(expected);
      expect(actual.path).not.toContain(values.zoo);
      expect(action.path).toBe(originalPath);
      expect(actual).not.toBe(action);
    });
  });
});
