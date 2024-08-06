import { CamsRole } from './roles';

describe('session', () => {
  describe('CamsRole enum', () => {
    test('should have expected values for the enum items', () => {
      expect(CamsRole.CaseAssignmentManager).toEqual('CaseAssignmentManager');
      expect(CamsRole.TrialAttorney).toEqual('TrialAttorney');
      expect(CamsRole.SuperUser).toEqual('SuperUser');
    });
  });
});
