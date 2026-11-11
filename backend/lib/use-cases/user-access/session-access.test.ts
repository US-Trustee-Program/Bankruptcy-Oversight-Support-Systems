import { CamsRole, CamsRoleType } from '@common/cams/roles';
import { UstpOfficeDetails } from '@common/cams/offices';
import { activeKeyFor, UserRoleAssignment } from '@common/cams/user-access';
import { readSessionAccess, sessionAccessFrom } from './session-access';
import { ApplicationContext } from '../../adapters/types/basic';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import { MockOfficesGateway } from '../../testing/mock-gateways/mock.offices.gateway';
import { MOCKED_USTP_OFFICES_ARRAY } from '@common/cams/test-utilities/offices.mock';

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
    active: true,
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

  test('should give no roles or offices without permissions', () => {
    expect(sessionAccessFrom([], OFFICES)).toEqual({ roles: [], offices: [] });
  });

  test('should still process permissions after a Super User permission', () => {
    const access = sessionAccessFrom(
      [
        permission(CamsRole.SuperUser, null, null),
        permission(CamsRole.Auditor, '3', WILMINGTON.officeCode),
      ],
      OFFICES,
    );

    expect(access.roles).toEqual([CamsRole.SuperUser, CamsRole.Auditor]);
    expect(codes(access.offices)).toEqual(codes([WILMINGTON]));
  });

  test('should drop a broader active permission when a narrower one for the same role overlaps it', () => {
    const access = sessionAccessFrom(
      [
        permission(CamsRole.TrialAttorney, '2', null),
        permission(CamsRole.TrialAttorney, '2', MANHATTAN.officeCode),
      ],
      OFFICES,
    );

    expect(access.roles).toEqual([CamsRole.TrialAttorney]);
    expect(codes(access.offices)).toEqual(codes([MANHATTAN]));
  });

  test('should drop a broader active permission regardless of array order', () => {
    const access = sessionAccessFrom(
      [
        permission(CamsRole.TrialAttorney, '2', MANHATTAN.officeCode),
        permission(CamsRole.TrialAttorney, '2', null),
      ],
      OFFICES,
    );

    expect(access.roles).toEqual([CamsRole.TrialAttorney]);
    expect(codes(access.offices)).toEqual(codes([MANHATTAN]));
  });

  test('should not let an overlapping permission for a different role suppress it', () => {
    const access = sessionAccessFrom(
      [
        permission(CamsRole.TrialAttorney, '2', null),
        permission(CamsRole.Auditor, '2', MANHATTAN.officeCode),
      ],
      OFFICES,
    );

    expect(access.roles).toEqual([CamsRole.TrialAttorney, CamsRole.Auditor]);
    expect(codes(access.offices)).toEqual(codes([MANHATTAN, BUFFALO]));
  });
});

describe('readSessionAccess', () => {
  const MANHATTAN_CODE = 'USTP_CAMS_Region_2_Office_Manhattan';
  let context: ApplicationContext;

  beforeEach(async () => {
    vi.restoreAllMocks();
    context = await createMockApplicationContext();
  });

  test('should read the active permissions of the user and the office list', async () => {
    const findSpy = vi
      .spyOn(MockMongoRepository.prototype, 'findActiveByUserIds')
      .mockResolvedValue([permission(CamsRole.TrialAttorney, '2', MANHATTAN_CODE)]);
    vi.spyOn(MockOfficesGateway.prototype, 'getOffices').mockResolvedValue(
      MOCKED_USTP_OFFICES_ARRAY,
    );

    const result = await readSessionAccess(context, 'user-a');

    expect(findSpy).toHaveBeenCalledWith(['user-a']);
    expect(result.permissionCount).toBe(1);
    expect(result.access.roles).toEqual([CamsRole.TrialAttorney]);
    expect(codes(result.access.offices)).toEqual([MANHATTAN_CODE]);
  });

  test('should start the office read without waiting for the permission read', async () => {
    let resolvePermissions: (value: UserRoleAssignment[]) => void = () => {};
    vi.spyOn(MockMongoRepository.prototype, 'findActiveByUserIds').mockReturnValue(
      new Promise((resolve) => (resolvePermissions = resolve)),
    );
    const officesSpy = vi
      .spyOn(MockOfficesGateway.prototype, 'getOffices')
      .mockResolvedValue(MOCKED_USTP_OFFICES_ARRAY);

    const pending = readSessionAccess(context, 'user-a');
    await Promise.resolve();

    expect(officesSpy).toHaveBeenCalledTimes(1);
    resolvePermissions([]);
    await pending;
  });

  test('should fail when the permissions cannot be read', async () => {
    vi.spyOn(MockMongoRepository.prototype, 'findActiveByUserIds').mockRejectedValue(
      new Error('cosmos unavailable'),
    );
    vi.spyOn(MockOfficesGateway.prototype, 'getOffices').mockResolvedValue([]);

    await expect(readSessionAccess(context, 'user-a')).rejects.toThrow('cosmos unavailable');
  });

  test('should fail when the office list cannot be read', async () => {
    vi.spyOn(MockMongoRepository.prototype, 'findActiveByUserIds').mockResolvedValue([]);
    vi.spyOn(MockOfficesGateway.prototype, 'getOffices').mockRejectedValue(new Error('dxtr down'));

    await expect(readSessionAccess(context, 'user-a')).rejects.toThrow('dxtr down');
  });
});
