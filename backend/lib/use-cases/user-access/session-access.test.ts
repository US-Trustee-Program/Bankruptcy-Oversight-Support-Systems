import { CamsRole, CamsRoleType } from '@common/cams/roles';
import { UstpOfficeDetails } from '@common/cams/offices';
import { activeKeyFor, UserRoleAssignment } from '@common/cams/user-access';
import { sessionAccessFrom } from './session-access';

function office(regionId: string, name: string): UstpOfficeDetails {
  return {
    officeCode: `USTP_CAMS_Region_${regionId}_Office_${name}`,
    idpGroupName: `USTP CAMS Region ${regionId} Office ${name}`,
    officeName: name,
    groups: [],
    regionId,
    regionName: `Region ${regionId}`,
  };
}

const MANHATTAN = office('2', 'Manhattan');
const BUFFALO = office('2', 'Buffalo');
const WILMINGTON = office('3', 'Wilmington');
const OFFICES = [MANHATTAN, BUFFALO, WILMINGTON];

function permission(
  role: CamsRoleType,
  regionId: string | null,
  officeCode: string | null,
  active = true,
): UserRoleAssignment {
  return {
    documentType: 'USER_ROLE_ASSIGNMENT',
    id: `${role}-${regionId ?? 'all'}-${officeCode ?? 'all'}`,
    userId: 'user-a',
    userName: 'Alice Adams',
    role,
    regionId,
    officeCode,
    assignedBy: 'super-1',
    assignedByName: 'Super User',
    assignedAt: '2026-11-09T00:00:00.000Z',
    expiresAt: null,
    active,
    activeKey: activeKeyFor(role, regionId, officeCode),
  };
}

const codes = (offices: UstpOfficeDetails[]) => offices.map((o) => o.officeCode);

describe('sessionAccessFrom', () => {
  test.each([
    {
      scope: 'one office',
      permissions: [permission(CamsRole.TrialAttorney, '2', MANHATTAN.officeCode)],
      roles: [CamsRole.TrialAttorney],
      offices: [MANHATTAN],
    },
    {
      scope: 'a whole region',
      permissions: [permission(CamsRole.TrialAttorney, '2', null)],
      roles: [CamsRole.TrialAttorney],
      offices: [MANHATTAN, BUFFALO],
    },
    {
      scope: 'every region',
      permissions: [permission(CamsRole.Auditor, null, null)],
      roles: [CamsRole.Auditor],
      offices: OFFICES,
    },
    {
      scope: 'Super User, with no offices',
      permissions: [permission(CamsRole.SuperUser, null, null)],
      roles: [CamsRole.SuperUser],
      offices: [],
    },
  ])('should expand $scope', ({ permissions, roles, offices }) => {
    const access = sessionAccessFrom(permissions, OFFICES);

    expect(access.roles).toEqual(roles);
    expect(codes(access.offices)).toEqual(codes(offices));
  });

  test('should merge roles and offices across permissions, each once', () => {
    const access = sessionAccessFrom(
      [
        permission(CamsRole.TrialAttorney, '2', MANHATTAN.officeCode),
        permission(CamsRole.Auditor, '2', null),
        permission(CamsRole.TrialAttorney, '3', WILMINGTON.officeCode),
        permission(CamsRole.SuperUser, null, null),
      ],
      OFFICES,
    );

    expect(access.roles).toEqual([CamsRole.TrialAttorney, CamsRole.Auditor, CamsRole.SuperUser]);
    expect(codes(access.offices)).toEqual(codes([MANHATTAN, BUFFALO, WILMINGTON]));
  });

  test('should return offices in office-list order, not grant order', () => {
    const access = sessionAccessFrom(
      [
        permission(CamsRole.TrialAttorney, '3', WILMINGTON.officeCode),
        permission(CamsRole.TrialAttorney, '2', MANHATTAN.officeCode),
      ],
      OFFICES,
    );

    expect(codes(access.offices)).toEqual(codes([MANHATTAN, WILMINGTON]));
  });

  test('should keep the role but no office when the office no longer exists', () => {
    const access = sessionAccessFrom(
      [permission(CamsRole.TrialAttorney, '2', 'USTP_CAMS_Region_2_Office_Closed')],
      OFFICES,
    );

    expect(access).toEqual({ roles: [CamsRole.TrialAttorney], offices: [] });
  });

  // The repository returns only active permissions; this guards the function on its own.
  test('should ignore inactive permissions', () => {
    const access = sessionAccessFrom(
      [permission(CamsRole.TrialAttorney, '2', MANHATTAN.officeCode, false)],
      OFFICES,
    );

    expect(access).toEqual({ roles: [], offices: [] });
  });

  test('should give no roles or offices without permissions', () => {
    expect(sessionAccessFrom([], OFFICES)).toEqual({ roles: [], offices: [] });
  });
});
