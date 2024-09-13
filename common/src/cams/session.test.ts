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
      const roles = [CamsRole.CaseAssignmentManager];
      const user = MockData.getCamsUser({ roles });
      const expected = { id: user.id, name: user.name, roles };
      const actual = getCamsUserReference(user);
      expect(actual).toEqual(expected);
    });
  });
});
