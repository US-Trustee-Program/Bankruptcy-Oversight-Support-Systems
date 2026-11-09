import { describe, test, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import {
  initializeTestServer,
  cleanupTestServer,
  getTestServerPort,
} from '../../helpers/api-server';
import { TestSessions } from '../../fixtures/auth.fixtures';
import { TestState } from '../../helpers/test-state';
import { TestSetup } from '../../helpers/fluent-test-setup';
import { clearAllRepositorySpies } from '../../helpers/repository-spies';
import { CamsSession } from '@common/cams/session';
import { CamsRole, CamsRoleType } from '@common/cams/roles';
import { CamsUserReference } from '@common/cams/users';
import { UserRoleAssignment } from '@common/cams/user-access';
import { MOCKED_USTP_OFFICE_DATA_MAP } from '@common/cams/test-utilities/offices.mock';

// ALWAYS import driver mocks
import '../../helpers/driver-mocks';

/**
 * Feature: IT SuperUser grants a role in an office (CAMS-940, Slice 1) — API level
 *
 * These scenarios exercise GET /api/user-access/users and
 * PUT /api/user-access/users/:userId/permissions/:role/:regionId/:officeCode
 * through the real Express server, use cases and controllers, with only the Okta group and
 * the Mongo repositories spied. The Permissions screen scenarios are covered with the UI.
 */

const MANHATTAN = MOCKED_USTP_OFFICE_DATA_MAP.get('USTP_CAMS_Region_2_Office_Manhattan')!;
const BUFFALO = MOCKED_USTP_OFFICE_DATA_MAP.get('USTP_CAMS_Region_2_Office_Buffalo')!;
const SEATTLE = MOCKED_USTP_OFFICE_DATA_MAP.get('USTP_CAMS_Region_18_Office_Seattle')!;

const SARAH: CamsUserReference = {
  id: 'okta-sarah',
  name: 'Sarah Williams',
  email: 'sarah.williams@example.com',
};
const ALEX: CamsUserReference = { id: 'okta-alex', name: 'Alex Brown', email: 'alex@example.com' };
const NOT_A_CAMS_USER = 'okta-former-employee';

function permission(
  userId: string,
  office: { regionId: string; officeCode: string },
  role: CamsRoleType = CamsRole.TrialAttorney,
): UserRoleAssignment {
  return {
    documentType: 'USER_ROLE_ASSIGNMENT',
    id: `${userId}-${role}-${office.officeCode}`,
    userId,
    userName: 'stored name',
    role,
    regionId: office.regionId,
    officeCode: office.officeCode,
    assignedBy: 'seed',
    assignedByName: 'Seed',
    assignedAt: '2026-10-01T00:00:00.000Z',
    expiresAt: null,
    active: true,
    activeKey: `${role}|${office.regionId}|${office.officeCode}`,
  };
}

function api(session: CamsSession, path: string, init: RequestInit = {}) {
  return fetch(`http://localhost:${getTestServerPort()}/api/user-access/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });
}

/** PUT the grant of Trial Attorney (by default) in the Manhattan office to Sarah. */
function grant(
  session: CamsSession,
  {
    role = CamsRole.TrialAttorney as CamsRoleType,
    regionId = MANHATTAN.regionId,
    officeCode = MANHATTAN.officeCode,
  } = {},
) {
  const path = ['users', SARAH.id, 'permissions', role, regionId, officeCode]
    .map(encodeURIComponent)
    .join('/');
  return api(session, path, { method: 'PUT', body: JSON.stringify({}) });
}

function setupFor(session: CamsSession) {
  return TestSetup.forUser(session)
    .withFeatureFlag('cams-role-assignments')
    .withOffices([MANHATTAN, BUFFALO, SEATTLE]);
}

describe('Feature: IT SuperUser grants a role in an office (API)', () => {
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
   * Scenario: The Permissions tab lists every CAMS user with their permissions
   *
   * GIVEN Maria, an IT SuperUser, is signed in
   * WHEN she requests the CAMS users
   * THEN each member of "USTP Cams Users" appears once, ordered by name
   * AND each user's active permissions are listed, ordered by region and then by office
   * AND a user with no permissions has an empty list
   * AND users who are not members do not appear, even if they have permissions
   * AND the list is paged 20 at a time
   * AND only each user's id, name and email come from their Okta profile
   */
  test('should list every CAMS user with their active permissions', async () => {
    const maria = TestSessions.superUser();
    const sarahOktaProfile = { ...SARAH, roles: [CamsRole.SuperUser], offices: [MANHATTAN] };
    await setupFor(maria)
      .withCamsUsers([sarahOktaProfile, ALEX])
      .withRoleAssignments([
        permission(SARAH.id, SEATTLE),
        permission(SARAH.id, MANHATTAN),
        permission(SARAH.id, BUFFALO),
        permission(NOT_A_CAMS_USER, MANHATTAN),
      ])
      .setUpBackend();

    const response = await api(maria, 'users');
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.pagination).toEqual(
      expect.objectContaining({ totalCount: 2, limit: 20, currentPage: 1, totalPages: 1 }),
    );
    expect(body.data.map((user: CamsUserReference) => user.name)).toEqual([
      'Alex Brown',
      'Sarah Williams',
    ]);
    expect(body.data[0].permissions).toEqual([]);
    expect(body.data[1].permissions.map((p: UserRoleAssignment) => p.officeCode)).toEqual([
      BUFFALO.officeCode,
      MANHATTAN.officeCode,
      SEATTLE.officeCode,
    ]);
    expect(Object.keys(body.data[1]).sort()).toEqual(['email', 'id', 'name', 'permissions']);
  });

  test('should return the requested page of 20 users', async () => {
    const maria = TestSessions.superUser();
    const many = Array.from({ length: 25 }, (_, i) => ({
      id: `user-${i}`,
      name: `User ${String(i).padStart(2, '0')}`,
    }));
    await setupFor(maria).withCamsUsers(many).setUpBackend();

    const response = await api(maria, 'users?offset=20');
    const body = await response.json();

    expect(body.pagination).toEqual(
      expect.objectContaining({ totalCount: 25, count: 5, currentPage: 2, totalPages: 2 }),
    );
    expect(body.data[0].name).toBe('User 20');
  });

  /**
   * Scenario: IT SuperUser grants Trial Attorney in the Manhattan office
   *
   * GIVEN Maria is signed in and Sarah Williams is a CAMS user
   * WHEN Maria grants Sarah Trial Attorney in Manhattan
   * THEN the grant is saved, assigned by Maria, with no expiry, and active
   * AND an audit record with action CREATED, performed by Maria, is saved
   * AND Sarah's row shows the new permission
   * (The Log Analytics event for the grant is covered by the use case unit tests.)
   */
  test('should grant Trial Attorney in the Manhattan office and audit it', async () => {
    const maria = TestSessions.superUser();
    const state = await setupFor(maria).withCamsUsers([SARAH, ALEX]).setUpBackend();

    const response = await grant(maria);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(state.getRoleAssignments()).toHaveLength(1);
    const [assignment] = state.getRoleAssignments();
    expect(body.data).toEqual({ permission: assignment, replaced: [] });
    expect(assignment).toEqual(
      expect.objectContaining({
        documentType: 'USER_ROLE_ASSIGNMENT',
        userId: SARAH.id,
        userName: SARAH.name,
        role: CamsRole.TrialAttorney,
        regionId: MANHATTAN.regionId,
        officeCode: MANHATTAN.officeCode,
        assignedBy: maria.user.id,
        assignedByName: maria.user.name,
        assignedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
        expiresAt: null,
        active: true,
      }),
    );
    expect(state.getRoleAssignmentAudits()).toEqual([
      expect.objectContaining({
        documentType: 'ROLE_ASSIGNMENT_AUDIT',
        assignmentId: assignment.id,
        action: 'CREATED',
        performedBy: maria.user.id,
        performedAt: assignment.assignedAt,
        replacedByAssignmentId: null,
      }),
    ]);

    const users = await (await api(maria, 'users')).json();
    const sarah = users.data.find((user: CamsUserReference) => user.id === SARAH.id);
    expect(sarah.permissions).toEqual([assignment]);
  });

  /**
   * Scenario: Only SuperUsers can use the capability
   *
   * GIVEN John Davis is signed in without the SuperUser role
   * THEN any request John makes to the permissions API is rejected with 403
   * (and the API is closed to everyone while cams-role-assignments is off)
   */
  test.each([
    {
      case: 'a user without the SuperUser role',
      session: () => TestSessions.caseAssignmentManager(),
      flag: true,
    },
    {
      case: 'a SuperUser while cams-role-assignments is off',
      session: () => TestSessions.superUser(),
      flag: false,
    },
  ])('should reject every permissions request from $case with 403', async ({ session, flag }) => {
    const user = session();
    const state = await TestSetup.forUser(user)
      .withFeatureFlag('cams-role-assignments', flag)
      .withOffices([MANHATTAN])
      .withCamsUsers([SARAH])
      .setUpBackend();

    const list = await api(user, 'users');
    const granted = await grant(user);

    expect(list.status).toBe(403);
    expect(granted.status).toBe(403);
    expect(state.getRoleAssignments()).toEqual([]);
    expect(state.getRoleAssignmentAudits()).toEqual([]);
  });

  /**
   * Scenario: Granting a permission the user already holds changes nothing
   *
   * GIVEN Sarah has an active Trial Attorney permission for "2 - Manhattan"
   * WHEN Maria grants Sarah Trial Attorney for "2 - Manhattan" again
   * THEN the API answers 200 with the permission Sarah already holds
   * AND no USER_ROLE_ASSIGNMENT or ROLE_ASSIGNMENT_AUDIT is written
   */
  test('should change nothing when Sarah already holds the permission', async () => {
    const maria = TestSessions.superUser();
    const held = permission(SARAH.id, MANHATTAN);
    const state = await setupFor(maria)
      .withCamsUsers([SARAH])
      .withRoleAssignments([held])
      .setUpBackend();

    const response = await grant(maria);

    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({ permission: held, replaced: [] });
    expect(state.getRoleAssignments()).toEqual([held]);
    expect(state.getRoleAssignmentAudits()).toEqual([]);
  });

  /**
   * Scenario: Two admins granting the same permission at once both succeed
   *
   * GIVEN another SuperUser's grant of Trial Attorney in Manhattan to Sarah was saved a moment ago,
   *   after Maria's request had already looked for it
   * WHEN Maria's grant is written
   * THEN the database's unique index stops a second copy, and Maria still gets success (200)
   * AND Sarah has exactly one active Trial Attorney permission for Manhattan, with no new audit
   */
  test('should treat a permission another grant saved a moment ago as already held', async () => {
    const maria = TestSessions.superUser();
    const savedByOtherAdmin = permission(SARAH.id, MANHATTAN);
    const state = await setupFor(maria).withCamsUsers([SARAH]).setUpBackend();
    const { UserRoleAssignmentMongoRepository } =
      await import('../../../../backend/lib/adapters/gateways/mongo/user-role-assignment.mongo.repository');
    // The other admin's grant lands just before Maria's write, so the unique index rejects hers.
    vi.spyOn(UserRoleAssignmentMongoRepository.prototype, 'create').mockImplementationOnce(
      async () => {
        state.addRoleAssignment(savedByOtherAdmin);
        return null;
      },
    );

    const response = await grant(maria);

    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({
      permission: savedByOtherAdmin,
      replaced: [],
    });
    expect(state.getRoleAssignments()).toEqual([savedByOtherAdmin]);
    expect(state.getRoleAssignmentAudits()).toEqual([]);
  });

  /**
   * Scenario: The same role in a different office is not a duplicate
   * (and neither is a different role in the same office)
   */
  test.each([
    { case: 'Trial Attorney in Buffalo', held: () => permission(SARAH.id, BUFFALO) },
    {
      case: 'Data Verifier in Manhattan',
      held: () => permission(SARAH.id, MANHATTAN, CamsRole.DataVerifier),
    },
  ])('should grant Trial Attorney in Manhattan when Sarah holds only $case', async ({ held }) => {
    const maria = TestSessions.superUser();
    const existing = held();
    const state = await setupFor(maria)
      .withCamsUsers([SARAH])
      .withRoleAssignments([existing])
      .setUpBackend();

    const response = await grant(maria);

    expect(response.status).toBe(201);
    expect(state.getRoleAssignments()).toHaveLength(2);
    expect(state.getRoleAssignments()).toContainEqual(existing);
    expect(state.getRoleAssignmentAudits()).toHaveLength(1);
  });

  test.each([
    {
      case: 'an office outside the given region',
      change: { regionId: SEATTLE.regionId },
      message: 'The office is not in that region.',
    },
    {
      case: 'an office without its region',
      change: { regionId: 'all' },
      message: 'An office needs its region.',
    },
    {
      case: 'an unknown region',
      change: { regionId: '99', officeCode: 'all' },
      message: 'The region does not exist.',
    },
  ])('should reject a grant for $case with a 400 and save nothing', async ({ change, message }) => {
    const maria = TestSessions.superUser();
    const state = await setupFor(maria).withCamsUsers([SARAH]).setUpBackend();

    const response = await grant(maria, change);

    expect(response.status).toBe(400);
    expect((await response.json()).message).toBe(message);
    expect(state.getRoleAssignments()).toEqual([]);
    expect(state.getRoleAssignmentAudits()).toEqual([]);
  });

  /**
   * Scenario: A failed audit write does not undo the grant but is recorded for follow-up
   *
   * GIVEN the ROLE_ASSIGNMENT_AUDIT write fails after the USER_ROLE_ASSIGNMENT is written
   * WHEN Maria saves a valid grant
   * THEN the grant is saved
   * AND an error is logged with a searchable message and the full audit payload
   */
  test('should keep the grant and log the audit payload when the audit write fails', async () => {
    const maria = TestSessions.superUser();
    const state = await setupFor(maria).withCamsUsers([SARAH]).setUpBackend();
    const { RoleAssignmentAuditMongoRepository } =
      await import('../../../../backend/lib/adapters/gateways/mongo/role-assignment-audit.mongo.repository');
    vi.spyOn(RoleAssignmentAuditMongoRepository.prototype, 'create').mockRejectedValue(
      new Error('Cosmos unavailable'),
    );
    const { LoggerImpl } = await import('../../../../backend/lib/adapters/services/logger.service');
    const errorSpy = vi.spyOn(LoggerImpl.prototype, 'error');

    const response = await grant(maria);

    expect(response.status).toBe(201);
    expect(state.getRoleAssignments()).toHaveLength(1);
    const [assignment] = state.getRoleAssignments();
    expect(assignment.userId).toBe(SARAH.id);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('ROLE_ASSIGNMENT_AUDIT write failed'),
      {
        audit: expect.objectContaining({
          assignmentId: assignment.id,
          userId: SARAH.id,
          role: CamsRole.TrialAttorney,
          regionId: MANHATTAN.regionId,
          officeCode: MANHATTAN.officeCode,
          performedBy: maria.user.id,
          performedAt: assignment.assignedAt,
          replacedByAssignmentId: null,
        }),
      },
    );
  });

  // ---------------------------------------------------------------------------
  // SLICE 3: region-wide, national and Super User grants, and the overlap rule
  // ---------------------------------------------------------------------------

  describe('broader scopes and the overlap rule', () => {
    const REGION_2 = { regionId: MANHATTAN.regionId, officeCode: 'all' };
    const NATIONAL = { regionId: 'all', officeCode: 'all' };
    const active = (state: TestState) => state.getRoleAssignments().filter((p) => p.active);
    const scopeOf = (p: UserRoleAssignment) => [p.role, p.regionId, p.officeCode];
    // Active permissions in any order: the API promises which ones remain, not how they are stored.
    function expectActiveScopes(state: TestState, expected: (string | null)[][]) {
      const actual = active(state).map(scopeOf);
      expect(actual).toHaveLength(expected.length);
      expect(actual).toEqual(expect.arrayContaining(expected));
    }

    async function sarahHolds(maria: CamsSession, held: UserRoleAssignment[]) {
      return setupFor(maria).withCamsUsers([SARAH]).withRoleAssignments(held).setUpBackend();
    }

    function regionWide(regionId: string | null, role: CamsRoleType = CamsRole.TrialAttorney) {
      return {
        ...permission(SARAH.id, MANHATTAN, role),
        id: `${SARAH.id}-${role}-${regionId ?? 'national'}`,
        regionId,
        officeCode: null,
        activeKey: `${role}|${regionId ?? '*'}|*`,
      };
    }

    /**
     * Scenarios: Grant a role for a whole region; Grant a role nationally; Grant the Super User
     * role, which has no scope; The API accepts a region-wide grant for a region with one office
     */
    test.each([
      { scope: 'a whole region', change: REGION_2, expected: [CamsRole.TrialAttorney, '2', null] },
      { scope: 'every region', change: NATIONAL, expected: [CamsRole.TrialAttorney, null, null] },
      {
        scope: 'Super User',
        change: { ...NATIONAL, role: CamsRole.SuperUser },
        expected: [CamsRole.SuperUser, null, null],
      },
      {
        scope: 'a region with one office',
        change: { regionId: SEATTLE.regionId, officeCode: 'all' },
        expected: [CamsRole.TrialAttorney, SEATTLE.regionId, null],
      },
    ])('should grant $scope', async ({ change, expected }) => {
      const maria = TestSessions.superUser();
      const state = await sarahHolds(maria, []);

      const response = await grant(maria, change);

      expect(response.status).toBe(201);
      expectActiveScopes(state, [expected]);
      expect(state.getRoleAssignmentAudits().map((a) => a.action)).toEqual(['CREATED']);
    });

    test('should reject a Super User grant with a region or office', async () => {
      const maria = TestSessions.superUser();
      const state = await sarahHolds(maria, []);

      const response = await grant(maria, { role: CamsRole.SuperUser });

      expect(response.status).toBe(400);
      expect((await response.json()).message).toBe('Super User has no region or office.');
      expect(state.getRoleAssignments()).toEqual([]);
    });

    /**
     * Scenario: A broader grant replaces the narrower ones it covers
     */
    test('should replace the narrower permissions a region-wide grant covers', async () => {
      const maria = TestSessions.superUser();
      const manhattan = permission(SARAH.id, MANHATTAN);
      const buffalo = permission(SARAH.id, BUFFALO);
      const otherRole = permission(SARAH.id, MANHATTAN, CamsRole.Auditor);
      const otherRegion = permission(SARAH.id, SEATTLE);
      const state = await sarahHolds(maria, [manhattan, buffalo, otherRole, otherRegion]);

      const response = await grant(maria, REGION_2);
      const body = await response.json();

      expect(response.status).toBe(201);
      expect(body.data.replaced.map((p: UserRoleAssignment) => p.id).sort()).toEqual(
        [manhattan.id, buffalo.id].sort(),
      );
      expectActiveScopes(state, [
        [CamsRole.Auditor, '2', MANHATTAN.officeCode],
        [CamsRole.TrialAttorney, SEATTLE.regionId, SEATTLE.officeCode],
        [CamsRole.TrialAttorney, '2', null],
      ]);
      const deactivated = state.getRoleAssignmentAudits().filter((a) => a.action === 'DEACTIVATED');
      expect(deactivated).toHaveLength(2);
      expect(deactivated).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            assignmentId: manhattan.id,
            performedBy: maria.user.id,
            replacedByAssignmentId: body.data.permission.id,
            newState: expect.objectContaining({ active: false }),
          }),
          expect.objectContaining({
            assignmentId: buffalo.id,
            replacedByAssignmentId: body.data.permission.id,
          }),
        ]),
      );
    });

    /**
     * Scenarios: A narrower grant replaces the broader one it overlaps; A narrower grant replaces a
     * national one; A national grant replaces region and office grants for the same role
     */
    test.each([
      {
        case: 'an office grant replaces the region-wide one',
        held: () => [regionWide('2')],
        change: {},
        remaining: [[CamsRole.TrialAttorney, '2', MANHATTAN.officeCode]],
      },
      {
        case: 'an office grant replaces the national one',
        held: () => [regionWide(null)],
        change: {},
        remaining: [[CamsRole.TrialAttorney, '2', MANHATTAN.officeCode]],
      },
      {
        case: 'a national grant replaces region and office grants',
        held: () => [
          regionWide('1'),
          permission(SARAH.id, MANHATTAN),
          regionWide(null, CamsRole.Auditor),
        ],
        change: NATIONAL,
        remaining: [
          [CamsRole.Auditor, null, null],
          [CamsRole.TrialAttorney, null, null],
        ],
      },
    ])('should apply the overlap rule: $case', async ({ held, change, remaining }) => {
      const maria = TestSessions.superUser();
      const heldPermissions = held();
      const replacedIds = heldPermissions
        .filter((p) => p.role === CamsRole.TrialAttorney)
        .map((p) => p.id)
        .sort();
      const state = await sarahHolds(maria, heldPermissions);

      const response = await grant(maria, change);
      const body = await response.json();

      expect(response.status).toBe(201);
      expectActiveScopes(state, remaining);
      // The replaced list drives the "was replaced by" alert, and each one gets its own audit.
      expect(body.data.replaced.map((p: UserRoleAssignment) => p.id).sort()).toEqual(replacedIds);
      const deactivatedIds = state
        .getRoleAssignmentAudits()
        .filter((a) => a.action === 'DEACTIVATED')
        .map((a) => a.assignmentId)
        .sort();
      expect(deactivatedIds).toEqual(replacedIds);
    });

    /**
     * Scenario: Granting a broad permission the user already holds changes nothing
     */
    test.each([
      { scope: 'every region', held: () => regionWide(null), change: NATIONAL },
      {
        scope: 'Super User',
        held: () => regionWide(null, CamsRole.SuperUser),
        change: { ...NATIONAL, role: CamsRole.SuperUser },
      },
    ])('should change nothing when Sarah already holds $scope', async ({ held, change }) => {
      const maria = TestSessions.superUser();
      const existing = held();
      const state = await sarahHolds(maria, [existing]);

      const response = await grant(maria, change);

      expect(response.status).toBe(200);
      expect((await response.json()).data).toEqual({ permission: existing, replaced: [] });
      expect(state.getRoleAssignments()).toEqual([existing]);
      expect(state.getRoleAssignmentAudits()).toEqual([]);
    });

    /**
     * Scenario: Granting again finishes a grant that only partly succeeded
     */
    test('should finish replacing overlapping permissions when the grant already exists', async () => {
      const maria = TestSessions.superUser();
      const region = regionWide('2');
      const manhattan = permission(SARAH.id, MANHATTAN);
      const state = await sarahHolds(maria, [region, manhattan]);

      const response = await grant(maria, REGION_2);

      expect(response.status).toBe(200);
      expect(active(state).map((p) => p.id)).toEqual([region.id]);
      expect(state.getRoleAssignmentAudits().map((a) => a.action)).toEqual(['DEACTIVATED']);
    });

    /**
     * Scenario: Two grants replacing the same permission at once audit it only once
     *
     * GIVEN Sarah holds Trial Attorney in Manhattan
     * AND another SuperUser's National grant replaced it a moment ago, after Maria's request had
     *   already read Sarah's permissions
     * WHEN Maria's Region 2 - All grant is written
     * THEN Maria's grant succeeds without replacing Manhattan again
     * AND Maria's grant writes no DEACTIVATED audit for Manhattan; the other grant already did
     */
    test('should not replace or audit a permission another grant replaced a moment ago', async () => {
      const maria = TestSessions.superUser();
      const manhattan = permission(SARAH.id, MANHATTAN);
      const state = await sarahHolds(maria, [manhattan]);
      const { UserRoleAssignmentMongoRepository } =
        await import('../../../../backend/lib/adapters/gateways/mongo/user-role-assignment.mongo.repository');
      // Maria's read sees Manhattan still active; the other grant deactivates it right after.
      vi.spyOn(
        UserRoleAssignmentMongoRepository.prototype,
        'findActiveByUserAndRole',
      ).mockImplementationOnce(async () => {
        state.updateRoleAssignment({
          ...manhattan,
          active: false,
          activeKey: `inactive|${manhattan.id}`,
        });
        return [manhattan];
      });

      const response = await grant(maria, REGION_2);

      expect(response.status).toBe(201);
      expect((await response.json()).data.replaced).toEqual([]);
      expectActiveScopes(state, [[CamsRole.TrialAttorney, '2', null]]);
      expect(state.getRoleAssignmentAudits().map((a) => a.action)).toEqual(['CREATED']);
    });

    test('should grant a scope again after it was replaced', async () => {
      const maria = TestSessions.superUser();
      const state = await sarahHolds(maria, [permission(SARAH.id, MANHATTAN)]);

      await grant(maria, REGION_2);
      const again = await grant(maria);

      expect(again.status).toBe(201);
      expectActiveScopes(state, [[CamsRole.TrialAttorney, '2', MANHATTAN.officeCode]]);
    });

    /**
     * Scenario: A replaced permission that cannot be deactivated is reported as a failure
     */
    test('should keep the new grant and report a failure when a replaced permission cannot be deactivated', async () => {
      const maria = TestSessions.superUser();
      const manhattan = permission(SARAH.id, MANHATTAN);
      const state = await sarahHolds(maria, [manhattan]);
      const { UserRoleAssignmentMongoRepository } =
        await import('../../../../backend/lib/adapters/gateways/mongo/user-role-assignment.mongo.repository');
      vi.spyOn(UserRoleAssignmentMongoRepository.prototype, 'deactivate').mockRejectedValue(
        new Error('Cosmos unavailable'),
      );
      const { LoggerImpl } =
        await import('../../../../backend/lib/adapters/services/logger.service');
      const errorSpy = vi.spyOn(LoggerImpl.prototype, 'error');

      const response = await grant(maria, REGION_2);

      expect(response.status).toBe(500);
      expectActiveScopes(state, [
        [CamsRole.TrialAttorney, '2', MANHATTAN.officeCode],
        [CamsRole.TrialAttorney, '2', null],
      ]);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('ROLE_ASSIGNMENT_DEACTIVATION failed'),
        expect.objectContaining({ replacedAssignmentId: manhattan.id }),
      );
    });
  });
});
