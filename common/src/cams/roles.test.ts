import { describe, test, expect } from 'vitest';
import { CamsRole, CamsRoleLabels, CamsRoles } from './roles';

describe('CamsRoles', () => {
  test('should list each unique CAMS role once, excluding PrivilegedIdentityUser', () => {
    expect([...CamsRoles].sort()).toEqual(
      [
        CamsRole.SuperUser,
        CamsRole.CaseAssignmentManager,
        CamsRole.TrialAttorney,
        CamsRole.LeadTrialAttorney,
        CamsRole.DataVerifier,
        CamsRole.TrusteeAdmin,
        CamsRole.Auditor,
        CamsRole.Paralegal,
      ].sort(),
    );
  });
});

describe('CamsRoleLabels', () => {
  test('should give each role its human-readable label', () => {
    expect(CamsRoleLabels).toEqual({
      PrivilegedIdentityUser: 'Privileged Identity User',
      SuperUser: 'Super User',
      CaseAssignmentManager: 'Case Assignment Manager',
      TrialAttorney: 'Trial Attorney',
      LeadTrialAttorney: 'Lead Trial Attorney',
      DataVerifier: 'Data Verifier',
      TrusteeAdmin: 'Trustee Admin',
      Auditor: 'Auditor',
      Paralegal: 'Paralegal',
    });
  });
});
