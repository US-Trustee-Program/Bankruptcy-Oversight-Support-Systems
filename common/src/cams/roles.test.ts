import { describe, test, expect } from 'vitest';
import { CamsRole, CamsRoles } from './roles';

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
