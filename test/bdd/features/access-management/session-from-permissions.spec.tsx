import { describe, test, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import {
  initializeTestServer,
  cleanupTestServer,
  getTestServerPort,
} from '../../helpers/api-server';
import { TestSessions } from '../../fixtures/auth.fixtures';
import { TestSetup } from '../../helpers/fluent-test-setup';
import { clearAllRepositorySpies } from '../../helpers/repository-spies';
import { CamsSession } from '@common/cams/session';
import { CamsRole, CamsRoleType } from '@common/cams/roles';
import { UstpOfficeDetails } from '@common/cams/offices';
import { activeKeyFor, UserRoleAssignment } from '@common/cams/user-access';
import { MOCKED_USTP_OFFICE_DATA_MAP } from '@common/cams/test-utilities/offices.mock';

// ALWAYS import driver mocks
import '../../helpers/driver-mocks';

/**
 * Feature: IT SuperUser grants a role in an office (CAMS-940, Slice 4) — sessions
 *
 * The grant takes effect at the user's next login. With cams-role-assignments on, a new session's
 * roles and offices come from the user's active permissions, not the AD groups in the Okta token.
 * Scenarios: SLICE 4 in superuser-grants-role.feature.
 *
 * Other BDD features stub the session cache so a session is never built. These scenarios make the
 * cache miss, so GET /api/me builds the session through the real UserSessionUseCase.
 */

const MANHATTAN = MOCKED_USTP_OFFICE_DATA_MAP.get('USTP_CAMS_Region_2_Office_Manhattan')!;
const BUFFALO = MOCKED_USTP_OFFICE_DATA_MAP.get('USTP_CAMS_Region_2_Office_Buffalo')!;
const SEATTLE = MOCKED_USTP_OFFICE_DATA_MAP.get('USTP_CAMS_Region_18_Office_Seattle')!;
const OFFICES = [MANHATTAN, BUFFALO, SEATTLE];

// AD groups that would grant Case Assignment Manager in Buffalo if they were still used.
const AD_GROUPS = [BUFFALO.idpGroupName, 'USTP CAMS Case Assignment Manager'];

function permission(
  userId: string,
  role: CamsRoleType,
  regionId: string | null,
  officeCode: string | null,
  active = true,
): UserRoleAssignment {
  return {
    documentType: 'USER_ROLE_ASSIGNMENT',
    id: `${userId}-${role}-${regionId ?? 'all'}-${officeCode ?? 'all'}`,
    userId,
    userName: 'Sarah Williams',
    role,
    regionId,
    officeCode,
    assignedBy: 'super-1',
    assignedByName: 'Maria Garcia',
    assignedAt: '2026-11-09T00:00:00.000Z',
    expiresAt: null,
    active,
    activeKey: active ? activeKeyFor(role, regionId, officeCode) : `inactive|${userId}`,
  };
}

/** Sarah's session as an Okta login would build it, given her permissions. */
async function sarahLogsIn(
  permissions: (sarahId: string) => UserRoleAssignment[],
  { flag = true, cached = false } = {},
) {
  const sarah = TestSessions.trialAttorney();
  // The fixture gives a random office; pin it so the cached session is predictable.
  sarah.user.offices = [MANHATTAN];
  await TestSetup.forUser(sarah)
    .withFeatureFlag('cams-role-assignments', flag)
    .withOffices(OFFICES)
    .withRoleAssignments(permissions(sarah.user.id))
    .setUpBackend();

  const OktaGateway = (await import('../../../../backend/lib/adapters/gateways/okta/okta-gateway'))
    .default;
  vi.spyOn(OktaGateway, 'getUser').mockResolvedValue({
    user: { id: sarah.user.id, name: sarah.user.name, email: sarah.user.email },
    groups: [],
    jwt: {
      claims: {
        sub: sarah.user.id,
        iss: sarah.issuer,
        aud: 'api://default',
        exp: sarah.expires,
        groups: AD_GROUPS,
      },
    },
  } as never);

  const { UserSessionCacheMongoRepository } =
    await import('../../../../backend/lib/adapters/gateways/mongo/user-session-cache.mongo.repository');
  const { NotFoundError } = await import('../../../../backend/lib/common-errors/not-found-error');
  if (!cached) {
    vi.spyOn(UserSessionCacheMongoRepository.prototype, 'read').mockRejectedValue(
      new NotFoundError('TEST'),
    );
  }
  const upsertSpy = vi
    .spyOn(UserSessionCacheMongoRepository.prototype, 'upsert')
    .mockImplementation(async (session: CamsSession) => session);

  return { sarah, upsertSpy };
}

async function me(session: CamsSession) {
  return fetch(`http://localhost:${getTestServerPort()}/api/me`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
  });
}

async function sessionUser(session: CamsSession) {
  const response = await me(session);
  expect(response.status).toBe(200);
  return (await response.json()).data.user as {
    roles: CamsRoleType[];
    offices: UstpOfficeDetails[];
  };
}

const codes = (offices: UstpOfficeDetails[]) => offices.map((office) => office.officeCode);

describe('Feature: IT SuperUser grants a role in an office (sessions)', () => {
  beforeAll(async () => {
    await initializeTestServer();
  });

  afterAll(async () => {
    await cleanupTestServer();
  });

  afterEach(async () => {
    await clearAllRepositorySpies();
  });

  /**
   * Scenarios: An office grant is in the session at next login; A region-wide grant expands to the
   * region's current offices; A national grant expands to every office; (Super User, no scope)
   */
  test.each([
    {
      scope: 'one office',
      permissions: (id: string) => [
        permission(id, CamsRole.TrialAttorney, MANHATTAN.regionId, MANHATTAN.officeCode),
      ],
      roles: [CamsRole.TrialAttorney],
      offices: [MANHATTAN.officeCode],
    },
    {
      scope: 'a whole region',
      permissions: (id: string) => [permission(id, CamsRole.TrialAttorney, '2', null)],
      roles: [CamsRole.TrialAttorney],
      offices: codes(OFFICES.filter((office) => office.regionId === '2')),
    },
    {
      scope: 'every region',
      permissions: (id: string) => [permission(id, CamsRole.TrialAttorney, null, null)],
      roles: [CamsRole.TrialAttorney],
      offices: codes(OFFICES),
    },
    {
      scope: 'an office that no longer exists',
      permissions: (id: string) => [
        permission(id, CamsRole.TrialAttorney, '2', 'USTP_CAMS_Region_2_Office_Closed'),
      ],
      roles: [CamsRole.TrialAttorney],
      offices: [],
    },
    {
      scope: 'Super User, with no offices',
      permissions: (id: string) => [permission(id, CamsRole.SuperUser, null, null)],
      roles: [CamsRole.SuperUser],
      offices: [],
    },
  ])(
    'should build the session from a grant for $scope',
    async ({ permissions, roles, offices }) => {
      const { sarah, upsertSpy } = await sarahLogsIn(permissions);

      const user = await sessionUser(sarah);

      expect(user.roles).toEqual(roles);
      expect(codes(user.offices)).toEqual(offices);
      expect(upsertSpy).toHaveBeenCalledTimes(1);
    },
  );

  /**
   * Scenario: With the flag on, AD groups no longer grant roles or offices
   */
  test('should give Sarah no roles or offices from her AD groups when she has no permissions', async () => {
    const { sarah } = await sarahLogsIn(() => []);

    const user = await sessionUser(sarah);

    expect(user.roles).toEqual([]);
    expect(user.offices).toEqual([]);
  });

  /**
   * Scenario: Inactive permissions do not grant access
   * (In production the repository returns only active permissions, as this harness's stub does;
   * sessionAccessFrom also ignores inactive ones, which its unit test covers.)
   */
  test('should ignore an inactive permission', async () => {
    const { sarah } = await sarahLogsIn((id) => [
      permission(id, CamsRole.TrialAttorney, MANHATTAN.regionId, MANHATTAN.officeCode, false),
    ]);

    const user = await sessionUser(sarah);

    expect(user.roles).toEqual([]);
    expect(user.offices).toEqual([]);
  });

  /**
   * Scenario: A session in progress is not changed by a new grant
   */
  test('should return the session in progress, unchanged by a newer grant', async () => {
    const { sarah, upsertSpy } = await sarahLogsIn(
      (id) => [permission(id, CamsRole.Auditor, '18', null)],
      { cached: true },
    );
    const { UserRoleAssignmentMongoRepository } =
      await import('../../../../backend/lib/adapters/gateways/mongo/user-role-assignment.mongo.repository');
    const findSpy = vi.spyOn(UserRoleAssignmentMongoRepository.prototype, 'findActiveByUserIds');

    const user = await sessionUser(sarah);

    // The cached session comes back exactly as it was; the grant waits for the next login.
    expect(user).toEqual(sarah.user);
    expect(user.roles).not.toContain(CamsRole.Auditor);
    expect(codes(user.offices ?? [])).not.toContain(SEATTLE.officeCode);
    expect(findSpy).not.toHaveBeenCalled();
    expect(upsertSpy).not.toHaveBeenCalled();
  });

  /**
   * Scenario: Privileged Identity still layers on top
   */
  test('should add an unexpired Privileged Identity elevation without duplicates', async () => {
    const { sarah } = await sarahLogsIn((id) => [
      permission(id, CamsRole.TrialAttorney, MANHATTAN.regionId, MANHATTAN.officeCode),
    ]);
    const { UsersMongoRepository } =
      await import('../../../../backend/lib/adapters/gateways/mongo/user.repository');
    vi.spyOn(UsersMongoRepository.prototype, 'getPrivilegedIdentityUser').mockResolvedValue({
      documentType: 'PRIVILEGED_IDENTITY_USER',
      id: sarah.user.id,
      userId: sarah.user.id,
      name: sarah.user.name,
      claims: {
        groups: [
          // Trial Attorney and Manhattan duplicate what Sarah's permission already grants.
          'USTP CAMS Trial Attorney',
          'USTP CAMS Case Assignment Manager',
          MANHATTAN.idpGroupName,
          SEATTLE.idpGroupName,
        ],
      },
      expires: '2999-01-01T00:00:00.000Z',
    } as never);

    // Each office read builds new objects, as in production, so de-duplication must use officeCode.
    const OfficesDxtrGateway = (
      await import('../../../../backend/lib/adapters/gateways/dxtr/offices.dxtr.gateway')
    ).default;
    vi.spyOn(OfficesDxtrGateway.prototype, 'getOffices').mockImplementation(async () =>
      OFFICES.map((office) => ({ ...office })),
    );

    const user = await sessionUser(sarah);

    expect(user.roles).toEqual([CamsRole.TrialAttorney, CamsRole.CaseAssignmentManager]);
    expect(codes(user.offices)).toEqual([MANHATTAN.officeCode, SEATTLE.officeCode]);
  });

  /**
   * Scenario: The session is denied when permissions cannot be read
   */
  test('should deny the session and cache nothing when permissions cannot be read', async () => {
    const { sarah, upsertSpy } = await sarahLogsIn(() => []);
    const { UserRoleAssignmentMongoRepository } =
      await import('../../../../backend/lib/adapters/gateways/mongo/user-role-assignment.mongo.repository');
    vi.spyOn(UserRoleAssignmentMongoRepository.prototype, 'findActiveByUserIds').mockRejectedValue(
      new Error('Cosmos unavailable'),
    );
    const { LoggerImpl } = await import('../../../../backend/lib/adapters/services/logger.service');
    const errorSpy = vi.spyOn(LoggerImpl.prototype, 'error');

    const response = await me(sarah);

    expect(response.status).toBe(401);
    expect(upsertSpy).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('SESSION_PERMISSIONS read failed'),
      { userId: sarah.user.id },
    );
  });

  /**
   * Scenario: With the flag off, sessions are built from AD groups as today
   */
  test('should build the session from AD groups when the flag is off, ignoring permissions', async () => {
    const { sarah } = await sarahLogsIn(
      (id) => [permission(id, CamsRole.TrialAttorney, MANHATTAN.regionId, MANHATTAN.officeCode)],
      { flag: false },
    );

    const user = await sessionUser(sarah);

    expect(user.roles).toEqual([CamsRole.CaseAssignmentManager]);
    expect(codes(user.offices)).toEqual([BUFFALO.officeCode]);
  });
});
