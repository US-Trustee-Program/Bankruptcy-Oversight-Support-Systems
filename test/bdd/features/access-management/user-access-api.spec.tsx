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

const GRANT_REASON =
  'New hire - Trial Attorney for Manhattan. Request forwarded by supervisor John Davis.';

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
  { reason = GRANT_REASON, regionId = MANHATTAN.regionId, officeCode = MANHATTAN.officeCode } = {},
) {
  const path = ['users', SARAH.id, 'permissions', CamsRole.TrialAttorney, regionId, officeCode]
    .map(encodeURIComponent)
    .join('/');
  return api(session, path, { method: 'PUT', body: JSON.stringify({ reason }) });
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
   * WHEN Maria grants Sarah Trial Attorney in Manhattan with a reason
   * THEN the grant is saved, assigned by Maria, with no expiry, and active
   * AND an audit record with action CREATED, performed by Maria, with the reason, is saved
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
        reason: GRANT_REASON,
      }),
    ]);

    const users = await (await api(maria, 'users')).json();
    const sarah = users.data.find((user: CamsUserReference) => user.id === SARAH.id);
    expect(sarah.permissions).toEqual([assignment]);
  });

  test('should reject an invalid grant with a 400 and save nothing', async () => {
    const maria = TestSessions.superUser();
    const state = await setupFor(maria).withCamsUsers([SARAH]).setUpBackend();

    const response = await grant(maria, { reason: '   ' });

    expect(response.status).toBe(400);
    expect((await response.json()).message).toMatch(/reason is required/i);
    expect(state.getRoleAssignments()).toEqual([]);
    expect(state.getRoleAssignmentAudits()).toEqual([]);
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
    const state = await setupFor(maria)
      .withCamsUsers([SARAH])
      .withRoleAssignments([savedByOtherAdmin])
      .setUpBackend();
    const { UserRoleAssignmentMongoRepository } =
      await import('../../../../backend/lib/adapters/gateways/mongo/user-role-assignment.mongo.repository');
    // Maria's first look happens before the other admin's grant lands.
    vi.spyOn(
      UserRoleAssignmentMongoRepository.prototype,
      'findActiveByUserAndRole',
    ).mockImplementationOnce(async () => []);

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
    { case: 'an office outside the given region', change: { regionId: SEATTLE.regionId } },
    { case: 'every office in a region (not yet)', change: { officeCode: 'all' } },
    { case: 'every region (not yet)', change: { regionId: 'all', officeCode: 'all' } },
  ])('should reject a grant for $case with a 400 and save nothing', async ({ change }) => {
    const maria = TestSessions.superUser();
    const state = await setupFor(maria).withCamsUsers([SARAH]).setUpBackend();

    const response = await grant(maria, change);

    expect(response.status).toBe(400);
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
          reason: GRANT_REASON,
        }),
      },
    );
  });
});
