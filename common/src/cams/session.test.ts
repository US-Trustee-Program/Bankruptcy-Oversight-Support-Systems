import { CamsRole } from './roles';
import { getCamsUserReference } from './session';
import MockData from './test-utilities/mock-data';

describe('session', () => {
  describe('CamsRole enum', () => {
    test('should have expected values for the enum items', () => {
      expect(CamsRole.CaseAssignmentManager).toEqual('CaseAssignmentManager');
      expect(CamsRole.TrialAttorney).toEqual('TrialAttorney');
      expect(CamsRole.SuperUser).toEqual('SuperUser');
    });
  });

  describe('getCamsUserReference', () => {
    test('should return a CamsUserReference with expected properties', () => {
      const user = MockData.getCamsUser();
      const expected = { id: user.id, name: user.name };
      const actual = getCamsUserReference(user);
      expect(actual).toEqual(expected);
    });
  });
});
