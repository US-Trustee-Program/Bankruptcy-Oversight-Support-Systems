import { vi } from 'vitest';
import { ApplicationContext } from '../../adapters/types/basic';
import { createMockApplicationContext, getTheThrownError } from '../../testing/testing-utilities';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import MockUserGroupGateway from '../../testing/mock-gateways/mock-user-group-gateway';
import { CamsRole, CamsRoleType } from '@common/cams/roles';
import { getCamsUserReference } from '@common/cams/session';
import { CamsUserReference } from '@common/cams/users';
import {
  RoleAssignmentAuditEntry,
  PermissionRemovalRequest,
  RoleAssignmentGrantRequest,
  UserRoleAssignment,
} from '@common/cams/user-access';
import { MOCKED_USTP_OFFICE_DATA_MAP } from '@common/cams/test-utilities/offices.mock';
import { UserAccessUseCase, resetCamsUsersCache } from './user-access';
import { CamsError } from '../../common-errors/cams-error';
import { MockOfficesGateway } from '../../testing/mock-gateways/mock.offices.gateway';

const MANHATTAN = MOCKED_USTP_OFFICE_DATA_MAP.get('USTP_CAMS_Region_2_Office_Manhattan')!;
const BUFFALO = MOCKED_USTP_OFFICE_DATA_MAP.get('USTP_CAMS_Region_2_Office_Buffalo')!;
const SEATTLE = MOCKED_USTP_OFFICE_DATA_MAP.get('USTP_CAMS_Region_18_Office_Seattle')!;

const FIFTEEN_MINUTES = 15 * 60 * 1000;

const members: CamsUserReference[] = [
  { id: 'user-c', name: 'Charlie Carter', email: 'charlie@example.com' },
  { id: 'user-a', name: 'Alice Adams', email: 'alice@example.com' },
  { id: 'user-b', name: 'Bob Baker', email: 'bob.baker@example.com' },
];

function assignmentFor(
  userId: string,
  office: { regionId: string; officeCode: string },
): UserRoleAssignment {
  return {
    documentType: 'USER_ROLE_ASSIGNMENT',
    id: `${userId}-${office.officeCode}`,
    userId,
    userName: 'irrelevant',
    role: CamsRole.TrialAttorney,
    regionId: office.regionId,
    officeCode: office.officeCode,
    assignedBy: 'super-1',
    assignedByName: 'Super User',
    assignedAt: '2026-11-01T00:00:00.000Z',
    active: true,
    activeKey: `TrialAttorney|${office.regionId}|${office.officeCode}`,
  };
}

function scopedAssignmentFor(
  userId: string,
  regionId: string | null,
  role: CamsRoleType = CamsRole.TrialAttorney,
): UserRoleAssignment {
  const scope = regionId ?? 'national';
  return {
    ...assignmentFor(userId, { regionId: regionId ?? '', officeCode: '' }),
    id: `${userId}-${role}-${scope}`,
    role,
    regionId,
    officeCode: null,
    activeKey: `${role}|${regionId ?? '*'}|*`,
  };
}

describe('UserAccessUseCase', () => {
  let context: ApplicationContext;
  let useCase: UserAccessUseCase;

  beforeEach(async () => {
    vi.restoreAllMocks();
    resetCamsUsersCache();
    context = await createMockApplicationContext();
    useCase = new UserAccessUseCase(context);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function spyOnMembers(users: CamsUserReference[] = members) {
    return vi
      .spyOn(MockUserGroupGateway.prototype, 'getUserGroupWithUsers')
      .mockResolvedValue({ id: 'group-1', name: 'USTP Cams Users', users });
  }

  describe('getCamsUsers', () => {
    test('should return a page of members ordered by name with the total count', async () => {
      spyOnMembers();

      const result = await useCase.getCamsUsers(context, { limit: 2, offset: 0 });

      expect(result.totalCount).toEqual(3);
      expect(result.data.map((user) => user.name)).toEqual(['Alice Adams', 'Bob Baker']);
    });

    test('should return the requested offset', async () => {
      spyOnMembers();

      const result = await useCase.getCamsUsers(context, { limit: 2, offset: 2 });

      expect(result.totalCount).toEqual(3);
      expect(result.data.map((user) => user.name)).toEqual(['Charlie Carter']);
    });

    test('should read the group that lists every CAMS user', async () => {
      const groupSpy = spyOnMembers();

      await useCase.getCamsUsers(context, { limit: 20, offset: 0 });

      expect(groupSpy).toHaveBeenCalledWith(expect.anything(), 'USTP Cams Users');
    });

    test.each([
      { filter: { name: 'BAKER' }, expected: ['Bob Baker'] },
      { filter: { name: 'a' }, expected: ['Alice Adams', 'Bob Baker', 'Charlie Carter'] },
      { filter: { email: 'Bob.Baker@' }, expected: ['Bob Baker'] },
      { filter: { name: 'alice', email: 'charlie' }, expected: [] },
    ])(
      'should filter members case-insensitively by $filter before paging',
      async ({ filter, expected }) => {
        spyOnMembers();

        const result = await useCase.getCamsUsers(context, { limit: 20, offset: 0, ...filter });

        expect(result.data.map((user) => user.name)).toEqual(expected);
        expect(result.totalCount).toEqual(expected.length);
      },
    );

    test('should filter before paging', async () => {
      spyOnMembers();

      const result = await useCase.getCamsUsers(context, { limit: 1, offset: 0, name: 'BAKER' });

      expect(result.data.map((user) => user.name)).toEqual(['Bob Baker']);
    });

    test('should return only the id, name and email of each member', async () => {
      const oktaUser = { ...members[0], roles: [CamsRole.SuperUser], offices: [MANHATTAN] };
      spyOnMembers([oktaUser]);

      const result = await useCase.getCamsUsers(context, { limit: 20, offset: 0 });

      expect(result.data).toEqual([{ ...members[0], permissions: [] }]);
    });

    test('should return no users when the group has no members', async () => {
      vi.spyOn(MockUserGroupGateway.prototype, 'getUserGroupWithUsers').mockResolvedValue({
        id: 'group-1',
        name: 'USTP Cams Users',
      });

      const result = await useCase.getCamsUsers(context, { limit: 20, offset: 0 });

      expect(result).toEqual({ data: [], totalCount: 0 });
    });

    test('should not fail on members without an email when filtering by email', async () => {
      spyOnMembers([{ id: 'user-x', name: 'No Email' }, ...members]);

      const result = await useCase.getCamsUsers(context, {
        limit: 20,
        offset: 0,
        email: 'alice',
      });

      expect(result.data.map((user) => user.name)).toEqual(['Alice Adams']);
    });

    test('should attach each user their active permissions ordered by region then office', async () => {
      spyOnMembers();
      const findSpy = vi
        .spyOn(MockMongoRepository.prototype, 'findActiveByUserIds')
        .mockResolvedValue([
          assignmentFor('user-a', SEATTLE),
          assignmentFor('user-b', MANHATTAN),
          assignmentFor('user-a', MANHATTAN),
          assignmentFor('user-a', BUFFALO),
        ]);

      const result = await useCase.getCamsUsers(context, { limit: 2, offset: 0 });

      expect(findSpy).toHaveBeenCalledWith(['user-a', 'user-b']);
      expect(result.data).toEqual([
        {
          ...members[1],
          permissions: [
            assignmentFor('user-a', BUFFALO),
            assignmentFor('user-a', MANHATTAN),
            assignmentFor('user-a', SEATTLE),
          ],
        },
        { ...members[2], permissions: [assignmentFor('user-b', MANHATTAN)] },
      ]);
    });

    test('should list an unscoped permission, such as Super User, before office permissions', async () => {
      spyOnMembers();
      const superUser: UserRoleAssignment = {
        ...assignmentFor('user-a', MANHATTAN),
        id: 'super',
        role: CamsRole.SuperUser,
        regionId: null,
        officeCode: null,
        activeKey: 'SuperUser|*|*',
      };
      vi.spyOn(MockMongoRepository.prototype, 'findActiveByUserIds').mockResolvedValue([
        assignmentFor('user-a', MANHATTAN),
        superUser,
      ]);

      const result = await useCase.getCamsUsers(context, { limit: 1, offset: 0 });

      expect(result.data[0].permissions).toEqual([superUser, assignmentFor('user-a', MANHATTAN)]);
    });

    test('should fetch the member list at most once every 15 minutes but read permissions every time', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-11-03T12:00:00Z'));
      const groupSpy = spyOnMembers();
      const findSpy = vi.spyOn(MockMongoRepository.prototype, 'findActiveByUserIds');

      await useCase.getCamsUsers(context, { limit: 20, offset: 0 });
      vi.setSystemTime(Date.now() + FIFTEEN_MINUTES - 1);
      await useCase.getCamsUsers(context, { limit: 20, offset: 0 });

      expect(groupSpy).toHaveBeenCalledTimes(1);
      expect(findSpy).toHaveBeenCalledTimes(2);

      vi.setSystemTime(Date.now() + 1);
      await useCase.getCamsUsers(context, { limit: 20, offset: 0 });

      expect(groupSpy).toHaveBeenCalledTimes(2);
    });

    test('should log whether the member list came from the cache', async () => {
      spyOnMembers();
      const debugSpy = vi.spyOn(context.logger, 'debug');

      await useCase.getCamsUsers(context, { limit: 20, offset: 0 });
      await useCase.getCamsUsers(context, { limit: 20, offset: 0 });

      expect(debugSpy).toHaveBeenCalledWith(
        'USER-ACCESS-USE-CASE',
        'CAMS users member list cache miss: read 3 members from Okta.',
      );
      expect(debugSpy).toHaveBeenCalledWith(
        'USER-ACCESS-USE-CASE',
        'CAMS users member list cache hit: 3 members.',
      );
    });

    test('should not cache a failed member list read', async () => {
      const groupSpy = vi
        .spyOn(MockUserGroupGateway.prototype, 'getUserGroupWithUsers')
        .mockRejectedValueOnce(new Error('Okta unavailable'))
        .mockResolvedValueOnce({ id: 'group-1', name: 'USTP Cams Users', users: members });

      await expect(useCase.getCamsUsers(context, { limit: 20, offset: 0 })).rejects.toThrow();
      const result = await useCase.getCamsUsers(context, { limit: 20, offset: 0 });

      expect(groupSpy).toHaveBeenCalledTimes(2);
      expect(result.totalCount).toEqual(3);
    });
  });

  describe('grantPermission', () => {
    const request: RoleAssignmentGrantRequest = {
      userId: 'user-a',
      role: CamsRole.TrialAttorney,
      regionId: MANHATTAN.regionId,
      officeCode: MANHATTAN.officeCode,
    };

    function spyOnWrites() {
      return {
        createSpy: vi
          .spyOn(MockMongoRepository.prototype, 'create')
          .mockImplementation((item) => Promise.resolve(item)),
        traceSpy: vi.spyOn(context.observability, 'completeTrace'),
      };
    }

    const auditWrites = (createSpy: ReturnType<typeof spyOnWrites>['createSpy']) =>
      createSpy.mock.calls
        .map(([item]) => item)
        .filter((item) => item.documentType === 'ROLE_ASSIGNMENT_AUDIT');

    function spyOnHeld(...held: UserRoleAssignment[][]) {
      const spy = vi.spyOn(MockMongoRepository.prototype, 'findActiveByUserAndRole');
      held.forEach((permissions) => spy.mockResolvedValueOnce(permissions));
      return spy.mockResolvedValue([]);
    }

    test('should write the permission, then its audit record, then a telemetry event', async () => {
      spyOnMembers();
      const heldSpy = spyOnHeld();
      const { createSpy, traceSpy } = spyOnWrites();
      const invalidateSpy = vi.spyOn(MockMongoRepository.prototype, 'deleteByUserId');
      const performer = getCamsUserReference(context.session.user);

      const { result, created } = await useCase.grantPermission(context, request);

      const expectedAssignment: UserRoleAssignment = {
        documentType: 'USER_ROLE_ASSIGNMENT',
        id: expect.any(String),
        userId: 'user-a',
        userName: 'Alice Adams',
        email: 'alice@example.com',
        role: CamsRole.TrialAttorney,
        regionId: MANHATTAN.regionId,
        officeCode: MANHATTAN.officeCode,
        assignedBy: performer.id,
        assignedByName: performer.name,
        assignedAt: expect.any(String),
        active: true,
        activeKey: `TrialAttorney|${MANHATTAN.regionId}|${MANHATTAN.officeCode}`,
      };
      const permission = result.permission;
      const expectedAudit: RoleAssignmentAuditEntry = {
        documentType: 'ROLE_ASSIGNMENT_AUDIT',
        id: expect.any(String),
        assignmentId: permission.id,
        action: 'CREATED',
        userId: 'user-a',
        userName: 'Alice Adams',
        role: CamsRole.TrialAttorney,
        regionId: MANHATTAN.regionId,
        officeCode: MANHATTAN.officeCode,
        performedBy: performer.id,
        performedByName: performer.name,
        performedAt: permission.assignedAt,
        previousState: null,
        newState: {
          role: CamsRole.TrialAttorney,
          regionId: MANHATTAN.regionId,
          officeCode: MANHATTAN.officeCode,
          active: true,
        },
        replacedByAssignmentId: null,
      };

      expect(created).toBe(true);
      expect(result).toEqual({ permission: expectedAssignment, replaced: [] });
      expect(heldSpy).toHaveBeenCalledWith('user-a', CamsRole.TrialAttorney);
      expect(createSpy).toHaveBeenCalledTimes(2);
      expect(createSpy).toHaveBeenNthCalledWith(1, expectedAssignment);
      expect(createSpy).toHaveBeenNthCalledWith(2, expectedAudit);
      expect(createSpy.mock.calls[1][0].id).not.toEqual(permission.id);
      expect(traceSpy).toHaveBeenCalledWith(
        expect.anything(),
        'RoleAssignmentAudit',
        expect.objectContaining({
          success: true,
          properties: expect.objectContaining({
            action: 'CREATED',
            assignmentId: permission.id,
            userId: 'user-a',
            role: CamsRole.TrialAttorney,
            regionId: MANHATTAN.regionId,
            officeCode: MANHATTAN.officeCode,
            performedBy: performer.id,
            replacedByAssignmentId: '',
          }),
        }),
        undefined,
        expect.anything(),
      );
      const { properties } = traceSpy.mock.calls[0][2];
      expect(properties).not.toHaveProperty('userName');
      expect(properties).not.toHaveProperty('performedByName');
      expect(invalidateSpy).toHaveBeenCalledWith('user-a');
    });

    test('should keep the grant and log a searchable error when cached sessions cannot be cleared', async () => {
      spyOnMembers();
      spyOnHeld();
      spyOnWrites();
      vi.spyOn(MockMongoRepository.prototype, 'deleteByUserId').mockRejectedValue(
        new Error('cache unavailable'),
      );
      const errorSpy = vi.spyOn(context.logger, 'error');

      const { created } = await useCase.grantPermission(context, request);

      expect(created).toBe(true);
      expect(errorSpy).toHaveBeenCalledWith(
        'USER-ACCESS-USE-CASE',
        'USER_SESSION_CACHE_INVALIDATION failed: cache unavailable',
        { userId: 'user-a' },
      );
    });

    test('should change nothing when the user already holds the permission', async () => {
      spyOnMembers();
      const held = assignmentFor('user-a', MANHATTAN);
      spyOnHeld([assignmentFor('user-a', BUFFALO), held]);
      const { createSpy, traceSpy } = spyOnWrites();
      const invalidateSpy = vi.spyOn(MockMongoRepository.prototype, 'deleteByUserId');

      const outcome = await useCase.grantPermission(context, request);

      expect(outcome).toEqual({ result: { permission: held, replaced: [] }, created: false });
      expect(createSpy).not.toHaveBeenCalled();
      expect(traceSpy).not.toHaveBeenCalled();
      // Re-granting an already-held permission still invalidates: a prior grant's invalidation may
      // have failed, and this is the retry (CAMS-940 review, backend/.../user-access.ts:267).
      expect(invalidateSpy).toHaveBeenCalledWith('user-a');
    });

    test('should treat a permission another grant just wrote as already held', async () => {
      spyOnMembers();
      const written = assignmentFor('user-a', MANHATTAN);
      spyOnHeld([], [written]);
      const { createSpy, traceSpy } = spyOnWrites();
      createSpy.mockResolvedValueOnce(null);

      const outcome = await useCase.grantPermission(context, request);

      expect(outcome).toEqual({ result: { permission: written, replaced: [] }, created: false });
      expect(auditWrites(createSpy)).toEqual([]);
      expect(traceSpy).not.toHaveBeenCalled();
    });

    test('should fail when a duplicate permission reported by the database cannot be found', async () => {
      spyOnMembers();
      spyOnHeld([], []);
      const { createSpy, traceSpy } = spyOnWrites();
      createSpy.mockResolvedValueOnce(null);

      const error = await getTheThrownError(() => useCase.grantPermission(context, request));

      expect(error).toEqual(
        expect.objectContaining({ status: 500, message: 'Unable to create role assignment.' }),
      );
      expect(auditWrites(createSpy)).toEqual([]);
      expect(traceSpy).not.toHaveBeenCalled();
    });

    test('should take the performer from the session, never from the request body', async () => {
      spyOnMembers();
      spyOnHeld();
      const { createSpy } = spyOnWrites();
      const forged = {
        ...request,
        assignedBy: 'attacker',
        performedBy: 'attacker',
        activeKey: 'forged',
      };

      const { result } = await useCase.grantPermission(context, forged);

      expect(result.permission.assignedBy).toEqual(context.session.user.id);
      expect(createSpy.mock.calls[1][0].performedBy).toEqual(context.session.user.id);
      expect(result.permission).not.toHaveProperty('performedBy');
      expect(result.permission.activeKey).toEqual(
        `TrialAttorney|${MANHATTAN.regionId}|${MANHATTAN.officeCode}`,
      );
    });

    test.each([
      {
        case: 'a user who is not a CAMS user',
        change: { userId: 'stranger' },
        message: /^The user is not a CAMS user\.$/,
      },
      {
        case: 'an unknown office',
        change: { officeCode: 'NOPE' },
        message: /^The office does not exist\.$/,
      },
      {
        case: 'an office outside the given region',
        change: { regionId: SEATTLE.regionId },
        message: /^The office is not in that region\.$/,
      },
      {
        case: 'an office without its region',
        change: { regionId: 'all' },
        message: /^An office needs its region\.$/,
      },
      {
        case: 'an unknown region',
        change: { regionId: '99', officeCode: 'all' },
        message: /^The region does not exist\.$/,
      },
      {
        case: 'a Super User grant for one office',
        change: { role: CamsRole.SuperUser },
        message: /^Super User has no region or office\.$/,
      },
      {
        case: 'a Super User grant for one office in every region',
        change: { role: CamsRole.SuperUser, regionId: 'all' },
        message: /^Super User has no region or office\.$/,
      },
      {
        case: 'a Super User grant for a region',
        change: { role: CamsRole.SuperUser, officeCode: 'all' },
        message: /^Super User has no region or office\.$/,
      },
    ])('should reject $case with a 400 and write nothing', async ({ change, message }) => {
      spyOnMembers();
      spyOnHeld();
      const { createSpy, traceSpy } = spyOnWrites();

      const error = await getTheThrownError(() =>
        useCase.grantPermission(context, { ...request, ...change }),
      );

      expect(error).toEqual(expect.objectContaining({ status: 400 }));
      expect(error.message).toMatch(message);
      expect(createSpy).not.toHaveBeenCalled();
      expect(traceSpy).not.toHaveBeenCalled();
    });

    test('should reject a missing request body with a 400 that says why', async () => {
      const error = await getTheThrownError(() =>
        useCase.grantPermission(context, undefined as unknown as RoleAssignmentGrantRequest),
      );

      expect(error).toEqual(
        expect.objectContaining({ status: 400, message: 'Value must be an object.' }),
      );
    });

    test('should keep the grant, log a searchable error with the audit payload, and report the audit as failed when the audit write fails', async () => {
      spyOnMembers();
      spyOnHeld();
      const { createSpy, traceSpy } = spyOnWrites();
      createSpy
        .mockImplementationOnce((item) => Promise.resolve(item))
        .mockRejectedValueOnce(new Error('cosmos unavailable'));
      const errorSpy = vi.spyOn(context.logger, 'error');

      const { result, created } = await useCase.grantPermission(context, request);

      const attemptedAudit = createSpy.mock.calls[1][0];
      expect(created).toBe(true);
      expect(result.permission).toEqual(createSpy.mock.calls[0][0]);
      expect(attemptedAudit).toEqual(
        expect.objectContaining({
          assignmentId: result.permission.id,
          replacedByAssignmentId: null,
        }),
      );
      expect(errorSpy).toHaveBeenCalledWith(
        'USER-ACCESS-USE-CASE',
        expect.stringContaining('ROLE_ASSIGNMENT_AUDIT write failed'),
        { audit: attemptedAudit },
      );
      // The telemetry event still records the grant, flagged as an audit that was not saved.
      expect(traceSpy).toHaveBeenCalledWith(
        expect.anything(),
        'RoleAssignmentAudit',
        expect.objectContaining({ success: false }),
        undefined,
        expect.anything(),
      );
    });

    test('should keep the grant and log when the telemetry event fails', async () => {
      spyOnMembers();
      spyOnHeld();
      spyOnWrites().traceSpy.mockImplementation(() => {
        throw new Error('telemetry down');
      });
      const errorSpy = vi.spyOn(context.logger, 'error');

      const { result } = await useCase.grantPermission(context, request);

      expect(result.permission.userId).toEqual('user-a');
      expect(errorSpy).toHaveBeenCalledWith(
        'USER-ACCESS-USE-CASE',
        'RoleAssignmentAudit telemetry failed: telemetry down',
        { auditId: expect.any(String) },
      );
    });

    test('should write no audit record or telemetry when the permission write fails', async () => {
      spyOnMembers();
      spyOnHeld();
      const { createSpy, traceSpy } = spyOnWrites();
      createSpy.mockRejectedValue(
        new CamsError('X', { message: 'Unable to create role assignment.' }),
      );

      await expect(useCase.grantPermission(context, request)).rejects.toThrow(
        'Unable to create role assignment.',
      );
      expect(auditWrites(createSpy)).toEqual([]);
      expect(traceSpy).not.toHaveBeenCalled();
    });

    test('should leave overlapping permissions in place when the new permission cannot be saved', async () => {
      spyOnMembers();
      spyOnHeld([scopedAssignmentFor('user-a', MANHATTAN.regionId)]);
      spyOnWrites().createSpy.mockRejectedValue(
        new CamsError('X', { message: 'Unable to create role assignment.' }),
      );
      const deactivateSpy = vi.spyOn(MockMongoRepository.prototype, 'deactivate');

      await expect(useCase.grantPermission(context, request)).rejects.toThrow(
        'Unable to create role assignment.',
      );
      expect(deactivateSpy).not.toHaveBeenCalled();
    });

    test('should change nothing when a Super User is granted Super User again', async () => {
      spyOnMembers();
      const held: UserRoleAssignment = {
        ...scopedAssignmentFor('user-a', null),
        role: CamsRole.SuperUser,
        activeKey: 'SuperUser|*|*',
      };
      spyOnHeld([held]);
      const { createSpy, traceSpy } = spyOnWrites();
      const deactivateSpy = vi.spyOn(MockMongoRepository.prototype, 'deactivate');

      const outcome = await useCase.grantPermission(context, {
        ...request,
        role: CamsRole.SuperUser,
        regionId: 'all',
        officeCode: 'all',
      });

      expect(outcome).toEqual({ result: { permission: held, replaced: [] }, created: false });
      expect(createSpy).not.toHaveBeenCalled();
      expect(deactivateSpy).not.toHaveBeenCalled();
      expect(traceSpy).not.toHaveBeenCalled();
    });

    describe('scopes', () => {
      test.each([
        {
          scope: 'a whole region',
          change: { officeCode: 'all' },
          role: CamsRole.TrialAttorney,
          expected: { regionId: MANHATTAN.regionId, officeCode: null },
        },
        {
          scope: 'every region',
          change: { regionId: 'all', officeCode: 'all' },
          role: CamsRole.TrialAttorney,
          expected: { regionId: null, officeCode: null },
        },
        {
          scope: 'Super User, which has no region or office',
          change: { regionId: 'all', officeCode: 'all' },
          role: CamsRole.SuperUser,
          expected: { regionId: null, officeCode: null },
        },
      ])('should grant $scope', async ({ change, role, expected }) => {
        spyOnMembers();
        spyOnHeld();
        const { createSpy } = spyOnWrites();

        const { result, created } = await useCase.grantPermission(context, {
          ...request,
          ...change,
          role,
        });

        expect(created).toBe(true);
        expect(result.permission).toEqual(
          expect.objectContaining({
            role,
            ...expected,
            activeKey: `${role}|${expected.regionId ?? '*'}|${expected.officeCode ?? '*'}`,
          }),
        );
        expect(auditWrites(createSpy)).toEqual([
          expect.objectContaining({ action: 'CREATED', ...expected }),
        ]);
      });
    });

    describe('the overlap rule', () => {
      const REGION_2 = { regionId: MANHATTAN.regionId, officeCode: 'all' };
      const NATIONAL = { regionId: 'all', officeCode: 'all' };

      function spyOnDeactivate() {
        return vi
          .spyOn(MockMongoRepository.prototype, 'deactivate')
          .mockImplementation((p: UserRoleAssignment) =>
            Promise.resolve({ ...p, active: false, activeKey: `inactive|${p.id}` }),
          );
      }

      test('should replace the narrower permissions a broader grant covers, each with its own audit', async () => {
        spyOnMembers();
        const manhattan = assignmentFor('user-a', MANHATTAN);
        const buffalo = assignmentFor('user-a', BUFFALO);
        const seattle = assignmentFor('user-a', SEATTLE);
        spyOnHeld([manhattan, buffalo, seattle]);
        const { createSpy, traceSpy } = spyOnWrites();
        const deactivateSpy = spyOnDeactivate();
        const performer = getCamsUserReference(context.session.user);

        const { result, created } = await useCase.grantPermission(context, {
          ...request,
          ...REGION_2,
        });

        expect(created).toBe(true);
        expect(deactivateSpy.mock.calls.map(([p]) => p.id)).toEqual([manhattan.id, buffalo.id]);
        expect(result.replaced).toEqual([
          { ...buffalo, active: false, activeKey: `inactive|${buffalo.id}` },
          { ...manhattan, active: false, activeKey: `inactive|${manhattan.id}` },
        ]);
        const deactivations = auditWrites(createSpy).filter((a) => a.action === 'DEACTIVATED');
        expect(deactivations).toEqual(
          [manhattan, buffalo].map((replaced) => ({
            documentType: 'ROLE_ASSIGNMENT_AUDIT',
            id: expect.any(String),
            assignmentId: replaced.id,
            action: 'DEACTIVATED',
            userId: replaced.userId,
            userName: replaced.userName,
            role: replaced.role,
            regionId: replaced.regionId,
            officeCode: replaced.officeCode,
            performedBy: performer.id,
            performedByName: performer.name,
            performedAt: result.permission.assignedAt,
            previousState: {
              role: replaced.role,
              regionId: replaced.regionId,
              officeCode: replaced.officeCode,
              active: true,
            },
            newState: {
              role: replaced.role,
              regionId: replaced.regionId,
              officeCode: replaced.officeCode,
              active: false,
            },
            replacedByAssignmentId: result.permission.id,
          })),
        );
        expect(traceSpy).toHaveBeenCalledTimes(3); // one CREATED, two DEACTIVATED
      });

      test('should list replaced permissions ordered by region, then office', async () => {
        spyOnMembers();
        spyOnHeld([
          assignmentFor('user-a', SEATTLE),
          assignmentFor('user-a', MANHATTAN),
          assignmentFor('user-a', BUFFALO),
        ]);
        spyOnWrites();
        spyOnDeactivate();

        const { result } = await useCase.grantPermission(context, { ...request, ...NATIONAL });

        // Region 2 before Region 18 (numeric, not string, order); within Region 2, by office.
        expect(result.replaced.map((p) => p.officeCode)).toEqual([
          BUFFALO.officeCode,
          MANHATTAN.officeCode,
          SEATTLE.officeCode,
        ]);
      });

      test.each([
        {
          case: 'a narrower grant replaces the region-wide one',
          held: () => scopedAssignmentFor('user-a', MANHATTAN.regionId),
          grant: {},
        },
        {
          case: 'a narrower grant replaces the national one',
          held: () => scopedAssignmentFor('user-a', null),
          grant: {},
        },
        {
          case: 'a national grant replaces a region-wide one',
          held: () => scopedAssignmentFor('user-a', '3'),
          grant: NATIONAL,
        },
      ])('should replace overlapping permissions: $case', async ({ held, grant }) => {
        spyOnMembers();
        const existing = held();
        spyOnHeld([existing]);
        const { createSpy } = spyOnWrites();
        spyOnDeactivate();

        const { result } = await useCase.grantPermission(context, { ...request, ...grant });

        expect(result.replaced.map((p) => p.id)).toEqual([existing.id]);
        expect(
          auditWrites(createSpy).find((a) => a.action === 'DEACTIVATED')?.replacedByAssignmentId,
        ).toEqual(result.permission.id);
      });

      test('should finish replacing overlapping permissions after another grant wrote the same permission', async () => {
        spyOnMembers();
        const written = assignmentFor('user-a', MANHATTAN);
        const regionWide = scopedAssignmentFor('user-a', MANHATTAN.regionId);
        spyOnHeld([], [written, regionWide]);
        const { createSpy } = spyOnWrites();
        createSpy.mockResolvedValueOnce(null);
        spyOnDeactivate();

        const { result, created } = await useCase.grantPermission(context, request);

        expect(created).toBe(false);
        expect(result.permission).toEqual(written);
        expect(result.replaced.map((p) => p.id)).toEqual([regionWide.id]);
        expect(auditWrites(createSpy).map((a) => a.action)).toEqual(['DEACTIVATED']);
      });

      test('should keep earlier replacements when a later one cannot be deactivated', async () => {
        spyOnMembers();
        const manhattan = assignmentFor('user-a', MANHATTAN);
        const buffalo = assignmentFor('user-a', BUFFALO);
        spyOnHeld([manhattan, buffalo]);
        const { createSpy } = spyOnWrites();
        const deactivateSpy = spyOnDeactivate();
        deactivateSpy
          .mockResolvedValueOnce({
            ...manhattan,
            active: false,
            activeKey: `inactive|${manhattan.id}`,
          })
          .mockRejectedValueOnce(new Error('cosmos unavailable'));

        const error = await getTheThrownError(() =>
          useCase.grantPermission(context, { ...request, ...REGION_2 }),
        );

        expect(error).toEqual(expect.objectContaining({ status: 500 }));
        const audits = auditWrites(createSpy);
        expect(audits.map((a) => a.action)).toEqual(['CREATED', 'DEACTIVATED']);
        expect(audits[1].assignmentId).toEqual(manhattan.id);
      });

      test('should neither list nor audit a permission another grant already replaced', async () => {
        spyOnMembers();
        const manhattan = assignmentFor('user-a', MANHATTAN);
        const buffalo = assignmentFor('user-a', BUFFALO);
        spyOnHeld([manhattan, buffalo]);
        const { createSpy } = spyOnWrites();
        spyOnDeactivate().mockResolvedValueOnce(null);

        const { result, created } = await useCase.grantPermission(context, {
          ...request,
          ...REGION_2,
        });

        expect(created).toBe(true);
        expect(result.replaced.map((p) => p.id)).toEqual([buffalo.id]);
        const audits = auditWrites(createSpy);
        expect(audits.map((a) => [a.action, a.assignmentId])).toEqual([
          ['CREATED', result.permission.id],
          ['DEACTIVATED', buffalo.id],
        ]);
      });

      test('should leave permissions that do not overlap alone', async () => {
        spyOnMembers();
        spyOnHeld([assignmentFor('user-a', BUFFALO), scopedAssignmentFor('user-a', '3')]);
        spyOnWrites();
        const deactivateSpy = spyOnDeactivate();

        const { result, created } = await useCase.grantPermission(context, request);

        expect(created).toBe(true);
        expect(result.replaced).toEqual([]);
        expect(deactivateSpy).not.toHaveBeenCalled();
      });

      test('should finish replacing overlapping permissions when the grant already exists', async () => {
        spyOnMembers();
        const regionWide = scopedAssignmentFor('user-a', MANHATTAN.regionId);
        const manhattan = assignmentFor('user-a', MANHATTAN);
        spyOnHeld([regionWide, manhattan]);
        const { createSpy } = spyOnWrites();
        const deactivateSpy = spyOnDeactivate();
        const invalidateSpy = vi.spyOn(MockMongoRepository.prototype, 'deleteByUserId');

        const { result, created } = await useCase.grantPermission(context, {
          ...request,
          ...REGION_2,
        });

        expect(created).toBe(false);
        expect(result.permission).toEqual(regionWide);
        expect(result.replaced.map((p) => p.id)).toEqual([manhattan.id]);
        expect(deactivateSpy).toHaveBeenCalledTimes(1);
        expect(auditWrites(createSpy).map((a) => a.action)).toEqual(['DEACTIVATED']);
        expect(invalidateSpy).toHaveBeenCalledWith('user-a');
      });

      test('should keep the grant, log both assignments and fail when a replaced permission cannot be deactivated', async () => {
        spyOnMembers();
        const manhattan = assignmentFor('user-a', MANHATTAN);
        spyOnHeld([manhattan]);
        const { createSpy } = spyOnWrites();
        spyOnDeactivate().mockRejectedValue(new Error('cosmos unavailable'));
        const errorSpy = vi.spyOn(context.logger, 'error');

        const error = await getTheThrownError(() =>
          useCase.grantPermission(context, { ...request, ...REGION_2 }),
        );

        const granted = createSpy.mock.calls[0][0] as UserRoleAssignment;
        expect(granted).toEqual(
          expect.objectContaining({ regionId: MANHATTAN.regionId, officeCode: null }),
        );
        expect(error).toEqual(
          expect.objectContaining({
            status: 500,
            message: 'Unable to replace an existing permission.',
          }),
        );
        expect(errorSpy).toHaveBeenCalledWith(
          'USER-ACCESS-USE-CASE',
          expect.stringContaining('ROLE_ASSIGNMENT_DEACTIVATION failed'),
          { grantedAssignmentId: granted.id, replacedAssignmentId: manhattan.id },
        );
        expect(auditWrites(createSpy).map((a) => a.action)).toEqual(['CREATED']);
      });
    });
  });

  describe('removePermission', () => {
    const held: UserRoleAssignment = {
      ...assignmentFor('user-a', MANHATTAN),
      userName: 'Alice Adams',
    };
    const request: PermissionRemovalRequest = { userId: 'user-a', permissionId: held.id };
    const deactivated: UserRoleAssignment = {
      ...held,
      active: false,
      activeKey: `inactive|${held.id}`,
    };

    function spyOnRemoval(removed: UserRoleAssignment | null = deactivated) {
      return {
        deactivateSpy: vi
          .spyOn(MockMongoRepository.prototype, 'deactivate')
          .mockResolvedValue(removed),
        createSpy: vi.spyOn(MockMongoRepository.prototype, 'create').mockResolvedValue(undefined),
        invalidateSpy: vi
          .spyOn(MockMongoRepository.prototype, 'deleteByUserId')
          .mockResolvedValue(undefined),
      };
    }

    test('should deactivate the permission with that id and audit it as removed by the Super User', async () => {
      const { deactivateSpy, createSpy } = spyOnRemoval();
      const performer = getCamsUserReference(context.session.user);

      await useCase.removePermission(context, request);

      const expectedAudit: RoleAssignmentAuditEntry = {
        documentType: 'ROLE_ASSIGNMENT_AUDIT',
        id: expect.any(String),
        assignmentId: held.id,
        action: 'DEACTIVATED',
        userId: 'user-a',
        userName: 'Alice Adams',
        role: CamsRole.TrialAttorney,
        regionId: MANHATTAN.regionId,
        officeCode: MANHATTAN.officeCode,
        performedBy: performer.id,
        performedByName: performer.name,
        performedAt: expect.any(String),
        previousState: {
          role: CamsRole.TrialAttorney,
          regionId: MANHATTAN.regionId,
          officeCode: MANHATTAN.officeCode,
          active: true,
        },
        newState: {
          role: CamsRole.TrialAttorney,
          regionId: MANHATTAN.regionId,
          officeCode: MANHATTAN.officeCode,
          active: false,
        },
        replacedByAssignmentId: null,
      };
      expect(deactivateSpy).toHaveBeenCalledWith({ userId: 'user-a', id: held.id });
      expect(createSpy).toHaveBeenCalledTimes(1);
      expect(createSpy).toHaveBeenCalledWith(expectedAudit);
    });

    test("should clear the user's cached sessions so the removal applies without signing in again", async () => {
      const { invalidateSpy } = spyOnRemoval();

      await useCase.removePermission(context, request);

      expect(invalidateSpy).toHaveBeenCalledWith('user-a');
    });

    test('should keep the removal and log the failure when clearing cached sessions fails', async () => {
      const { deactivateSpy, createSpy, invalidateSpy } = spyOnRemoval();
      invalidateSpy.mockRejectedValue(new Error('session cache down'));
      const errorSpy = vi.spyOn(context.logger, 'error');

      await expect(useCase.removePermission(context, request)).resolves.toBeUndefined();

      expect(deactivateSpy).toHaveBeenCalled();
      expect(createSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.stringContaining('session cache down'),
        { userId: 'user-a' },
      );
    });

    test('should change nothing when the permission is no longer active, or is not that user’s', async () => {
      const { createSpy, invalidateSpy } = spyOnRemoval(null);

      await expect(useCase.removePermission(context, request)).resolves.toBeUndefined();

      expect(createSpy).not.toHaveBeenCalled();
      expect(invalidateSpy).not.toHaveBeenCalled();
    });

    test('should remove a permission for an office that no longer exists, without reading the office list', async () => {
      const officesSpy = vi.spyOn(MockOfficesGateway.prototype, 'getOffices');
      const retired = { ...deactivated, regionId: '99', officeCode: 'RETIRED_OFFICE' };
      const { createSpy } = spyOnRemoval(retired);

      await useCase.removePermission(context, request);

      expect(officesSpy).not.toHaveBeenCalled();
      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'DEACTIVATED',
          regionId: '99',
          officeCode: 'RETIRED_OFFICE',
          previousState: expect.objectContaining({ officeCode: 'RETIRED_OFFICE', active: true }),
        }),
      );
    });

    test.each([
      { name: 'a blank user', change: { userId: ' ' } },
      { name: 'a blank permission', change: { permissionId: '' } },
      { name: 'a missing permission', change: { permissionId: undefined } },
    ])('should reject a removal with $name and change nothing', async ({ change }) => {
      const { deactivateSpy } = spyOnRemoval();

      const error = await getTheThrownError(() =>
        useCase.removePermission(context, { ...request, ...change } as PermissionRemovalRequest),
      );

      expect(error).toEqual(expect.objectContaining({ status: 400 }));
      expect(deactivateSpy).not.toHaveBeenCalled();
    });

    test('should refuse a Super User’s removal of their own permission and change nothing', async () => {
      const { deactivateSpy } = spyOnRemoval();

      const error = await getTheThrownError(() =>
        useCase.removePermission(context, { ...request, userId: context.session.user.id }),
      );

      expect(error).toEqual(
        expect.objectContaining({
          status: 400,
          message: 'You cannot remove your own permissions.',
        }),
      );
      expect(deactivateSpy).not.toHaveBeenCalled();
    });

    describe('a Super User permission', () => {
      const superUser: UserRoleAssignment = {
        ...held,
        id: 'super-user-a',
        role: CamsRole.SuperUser,
        regionId: null,
        officeCode: null,
        activeKey: 'SuperUser',
      };
      const removedSuperUser: UserRoleAssignment = {
        ...superUser,
        active: false,
        activeKey: `inactive|${superUser.id}`,
      };
      const superUserRequest = { userId: 'user-a', permissionId: superUser.id };

      function spyOnSuperUsersLeft(count: number) {
        return {
          countSpy: vi
            .spyOn(MockMongoRepository.prototype, 'countActiveByRole')
            .mockResolvedValue(count),
          reactivateSpy: vi
            .spyOn(MockMongoRepository.prototype, 'reactivate')
            .mockResolvedValue(superUser),
        };
      }

      test('should remove it while another Super User remains', async () => {
        const { createSpy, invalidateSpy } = spyOnRemoval(removedSuperUser);
        const { countSpy, reactivateSpy } = spyOnSuperUsersLeft(1);

        await useCase.removePermission(context, superUserRequest);

        expect(countSpy).toHaveBeenCalledWith(CamsRole.SuperUser);
        expect(reactivateSpy).not.toHaveBeenCalled();
        expect(createSpy).toHaveBeenCalledWith(
          expect.objectContaining({ action: 'DEACTIVATED', assignmentId: superUser.id }),
        );
        expect(invalidateSpy).toHaveBeenCalledWith('user-a');
      });

      test('should restore it and refuse the removal when no other Super User remains', async () => {
        const { createSpy, invalidateSpy } = spyOnRemoval(removedSuperUser);
        const { reactivateSpy } = spyOnSuperUsersLeft(0);

        const error = await getTheThrownError(() =>
          useCase.removePermission(context, superUserRequest),
        );

        expect(error).toEqual(
          expect.objectContaining({
            status: 400,
            message: 'CAMS must keep at least one Super User.',
          }),
        );
        expect(reactivateSpy).toHaveBeenCalledWith(removedSuperUser);
        expect(createSpy).not.toHaveBeenCalled();
        expect(invalidateSpy).not.toHaveBeenCalled();
      });
    });

    test('should remove a permission from a user who is no longer a CAMS user', async () => {
      spyOnMembers([]);
      const { deactivateSpy } = spyOnRemoval();

      await useCase.removePermission(context, request);

      expect(deactivateSpy).toHaveBeenCalledWith({ userId: 'user-a', id: held.id });
    });

    test('should send the removal to Log Analytics', async () => {
      spyOnRemoval();
      const traceSpy = vi.spyOn(context.observability, 'completeTrace');

      await useCase.removePermission(context, request);

      expect(traceSpy).toHaveBeenCalledWith(
        expect.anything(),
        'RoleAssignmentAudit',
        expect.objectContaining({
          success: true,
          properties: expect.objectContaining({
            action: 'DEACTIVATED',
            assignmentId: held.id,
            replacedByAssignmentId: '',
          }),
        }),
        undefined,
        expect.anything(),
      );
    });

    test('should keep the removal and log the searchable message when the audit write fails', async () => {
      const { createSpy, invalidateSpy } = spyOnRemoval();
      createSpy.mockRejectedValue(new Error('audit store down'));
      const errorSpy = vi.spyOn(context.logger, 'error');

      await expect(useCase.removePermission(context, request)).resolves.toBeUndefined();

      expect(errorSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.stringContaining('ROLE_ASSIGNMENT_AUDIT write failed'),
        expect.anything(),
      );
      expect(invalidateSpy).toHaveBeenCalledWith('user-a');
    });
  });

  describe('getPermissionChanges', () => {
    const performer = { performedBy: 'super-1', performedByName: 'Maria Garcia' };
    const manhattan = {
      role: CamsRole.TrialAttorney,
      regionId: MANHATTAN.regionId,
      officeCode: MANHATTAN.officeCode,
    };
    const allOfRegion2 = { role: CamsRole.TrialAttorney, regionId: '02', officeCode: null };

    function audit(
      id: string,
      action: 'CREATED' | 'DEACTIVATED',
      performedAt: string,
      states: Pick<
        RoleAssignmentAuditEntry,
        'previousState' | 'newState' | 'replacedByAssignmentId'
      >,
    ): RoleAssignmentAuditEntry {
      const scope = (states.newState ?? states.previousState)!;
      return {
        documentType: 'ROLE_ASSIGNMENT_AUDIT',
        id,
        assignmentId: `assignment-${id}`,
        action,
        userId: 'user-a',
        userName: 'Sarah Williams',
        role: scope.role,
        regionId: scope.regionId,
        officeCode: scope.officeCode,
        ...performer,
        performedAt,
        ...states,
      };
    }

    const granted = audit('a1', 'CREATED', '2026-11-02T10:00:00.000Z', {
      previousState: null,
      newState: { ...manhattan, active: true },
      replacedByAssignmentId: null,
    });
    const replaced = audit('a2', 'DEACTIVATED', '2026-11-20T10:00:00.000Z', {
      previousState: { ...manhattan, active: true },
      newState: { ...manhattan, active: false },
      replacedByAssignmentId: 'replacing-1',
    });
    const removed = audit('a3', 'DEACTIVATED', '2026-11-25T10:00:00.000Z', {
      previousState: { ...allOfRegion2, active: true },
      newState: { ...allOfRegion2, active: false },
      replacedByAssignmentId: null,
    });
    const replacing: UserRoleAssignment = {
      ...assignmentFor('user-a', MANHATTAN),
      id: 'replacing-1',
      ...allOfRegion2,
    };

    function spyOnAudits(data: RoleAssignmentAuditEntry[], total = data.length) {
      return vi
        .spyOn(MockMongoRepository.prototype, 'search')
        .mockResolvedValue({ metadata: { total }, data });
    }

    test('should return the page of changes as the audit search orders it, with the total', async () => {
      const searchSpy = spyOnAudits([removed, granted], 41);
      vi.spyOn(MockMongoRepository.prototype, 'findByIds').mockResolvedValue([]);

      const result = await useCase.getPermissionChanges(context, { limit: 20, offset: 20 });

      expect(searchSpy).toHaveBeenCalledWith({ limit: 20, offset: 20 });
      expect(result).toEqual({
        totalCount: 41,
        data: [
          {
            auditId: 'a3',
            assignmentId: 'assignment-a3',
            userId: 'user-a',
            userName: 'Sarah Williams',
            ...performer,
            performedAt: '2026-11-25T10:00:00.000Z',
            kind: 'removed',
            previous: allOfRegion2,
            next: null,
          },
          {
            auditId: 'a1',
            assignmentId: 'assignment-a1',
            userId: 'user-a',
            userName: 'Sarah Williams',
            ...performer,
            performedAt: '2026-11-02T10:00:00.000Z',
            kind: 'granted',
            previous: null,
            next: manhattan,
          },
        ],
      });
    });

    test('should show what replaced a permission, reading the replacing permissions once, by user and id', async () => {
      spyOnAudits([replaced]);
      const findByIdsSpy = vi
        .spyOn(MockMongoRepository.prototype, 'findByIds')
        .mockResolvedValue([replacing]);

      const { data } = await useCase.getPermissionChanges(context, { limit: 20, offset: 0 });

      expect(findByIdsSpy).toHaveBeenCalledTimes(1);
      expect(findByIdsSpy).toHaveBeenCalledWith([{ userId: 'user-a', id: 'replacing-1' }]);
      expect(data).toEqual([
        expect.objectContaining({ kind: 'replaced', previous: manhattan, next: allOfRegion2 }),
      ]);
    });

    test("should match each replacement to its own user's replacing permission, even when ids repeat", async () => {
      const replacedForB: RoleAssignmentAuditEntry = {
        ...replaced,
        id: 'b2',
        userId: 'user-b',
        userName: 'Bob Brown',
      };
      const replacingForB: UserRoleAssignment = {
        ...replacing,
        userId: 'user-b',
        regionId: null,
        officeCode: null,
      };
      spyOnAudits([replaced, replacedForB]);
      const findByIdsSpy = vi
        .spyOn(MockMongoRepository.prototype, 'findByIds')
        .mockResolvedValue([replacingForB, replacing]);

      const { data } = await useCase.getPermissionChanges(context, { limit: 20, offset: 0 });

      expect(findByIdsSpy).toHaveBeenCalledTimes(1);
      expect(findByIdsSpy).toHaveBeenCalledWith([
        { userId: 'user-a', id: 'replacing-1' },
        { userId: 'user-b', id: 'replacing-1' },
      ]);

      expect(data.map(({ userId, next }) => ({ userId, next }))).toEqual([
        { userId: 'user-a', next: allOfRegion2 },
        {
          userId: 'user-b',
          next: { role: CamsRole.TrialAttorney, regionId: null, officeCode: null },
        },
      ]);
    });

    test('should leave New empty for a replacement whose replacing permission cannot be read', async () => {
      spyOnAudits([replaced]);
      vi.spyOn(MockMongoRepository.prototype, 'findByIds').mockResolvedValue([]);

      const { data } = await useCase.getPermissionChanges(context, { limit: 20, offset: 0 });

      expect(data).toEqual([
        expect.objectContaining({ kind: 'replaced', previous: manhattan, next: null }),
      ]);
    });

    test('should accept a limit of 100', async () => {
      const searchSpy = spyOnAudits([]);
      vi.spyOn(MockMongoRepository.prototype, 'findByIds').mockResolvedValue([]);

      await useCase.getPermissionChanges(context, { limit: 100, offset: 0 });

      expect(searchSpy).toHaveBeenCalledWith({ limit: 100, offset: 0 });
    });

    test.each([
      { name: 'a negative offset', paging: { limit: 20, offset: -1 } },
      { name: 'a zero limit', paging: { limit: 0, offset: 0 } },
      { name: 'a fractional limit', paging: { limit: 1.5, offset: 0 } },
      { name: 'a fractional offset', paging: { limit: 20, offset: 1.5 } },
      { name: 'a limit over 100', paging: { limit: 101, offset: 0 } },
      { name: 'a limit that is not a number', paging: { limit: NaN, offset: 0 } },
    ])('should reject $name without reading the history', async ({ paging }) => {
      const searchSpy = spyOnAudits([]);

      const error = await getTheThrownError(() => useCase.getPermissionChanges(context, paging));

      expect(error).toEqual(expect.objectContaining({ status: 400 }));
      expect(searchSpy).not.toHaveBeenCalled();
    });
  });

  describe('with the DATABASE_MOCK repository and no spies on it', () => {
    beforeEach(() => {
      MockMongoRepository.clearRoleAssignments();
    });

    test('should order changes made at the same moment by id, highest first', async () => {
      spyOnMembers();
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-11-02T10:00:00.000Z'));
      for (const officeCode of [MANHATTAN.officeCode, BUFFALO.officeCode]) {
        await useCase.grantPermission(context, {
          userId: 'user-b',
          role: CamsRole.TrialAttorney,
          regionId: MANHATTAN.regionId,
          officeCode,
        });
      }

      const { data } = await useCase.getPermissionChanges(context, { limit: 20, offset: 0 });

      const ids = data.map((change) => change.auditId);
      expect(ids).toHaveLength(2);
      expect(ids).toEqual([...ids].sort().reverse());
    });

    test('should list every grant, replacement and removal newest first, showing what replaced a permission', async () => {
      spyOnMembers();
      vi.useFakeTimers({ toFake: ['Date'] });
      const grant = (regionId: string, officeCode: string) =>
        useCase.grantPermission(context, {
          userId: 'user-b',
          role: CamsRole.TrialAttorney,
          regionId,
          officeCode,
        });

      vi.setSystemTime(new Date('2026-11-02T10:00:00.000Z'));
      await grant(MANHATTAN.regionId, MANHATTAN.officeCode);
      vi.setSystemTime(new Date('2026-11-20T10:00:00.000Z'));
      const { result } = await grant(MANHATTAN.regionId, 'all');
      vi.setSystemTime(new Date('2026-11-25T10:00:00.000Z'));
      await useCase.removePermission(context, {
        userId: 'user-b',
        permissionId: result.permission.id,
      });

      const firstPage = await useCase.getPermissionChanges(context, { limit: 3, offset: 0 });
      const secondPage = await useCase.getPermissionChanges(context, { limit: 3, offset: 3 });

      const manhattan = {
        role: CamsRole.TrialAttorney,
        regionId: MANHATTAN.regionId,
        officeCode: MANHATTAN.officeCode,
      };
      const allOffices = {
        role: CamsRole.TrialAttorney,
        regionId: MANHATTAN.regionId,
        officeCode: null,
      };
      expect(firstPage.totalCount).toEqual(4);
      expect(
        [...firstPage.data, ...secondPage.data].map(({ kind, previous, next, performedAt }) => ({
          kind,
          previous,
          next,
          performedAt,
        })),
      ).toEqual([
        {
          kind: 'removed',
          previous: allOffices,
          next: null,
          performedAt: '2026-11-25T10:00:00.000Z',
        },
        {
          kind: 'replaced',
          previous: manhattan,
          next: allOffices,
          performedAt: '2026-11-20T10:00:00.000Z',
        },
        {
          kind: 'granted',
          previous: null,
          next: allOffices,
          performedAt: '2026-11-20T10:00:00.000Z',
        },
        {
          kind: 'granted',
          previous: null,
          next: manhattan,
          performedAt: '2026-11-02T10:00:00.000Z',
        },
      ]);
    });

    test('should grant a permission, list it, and treat a repeat grant as already held', async () => {
      spyOnMembers();
      const request: RoleAssignmentGrantRequest = {
        userId: 'user-b',
        role: CamsRole.TrialAttorney,
        regionId: MANHATTAN.regionId,
        officeCode: MANHATTAN.officeCode,
      };

      const first = await useCase.grantPermission(context, request);
      const repeat = await useCase.grantPermission(context, request);
      const { data } = await useCase.getCamsUsers(context, { name: 'Bob', limit: 20, offset: 0 });

      expect(first.created).toBe(true);
      expect(repeat).toEqual({
        result: { permission: first.result.permission, replaced: [] },
        created: false,
      });
      expect(data[0].permissions).toEqual([first.result.permission]);
    });

    test('should remove a granted permission by its id, and change nothing when removing it again', async () => {
      spyOnMembers();
      const { result } = await useCase.grantPermission(context, {
        userId: 'user-b',
        role: CamsRole.Auditor,
        regionId: 'all',
        officeCode: 'all',
      });
      const removal = { userId: 'user-b', permissionId: result.permission.id };
      const auditSpy = vi.spyOn(MockMongoRepository.prototype, 'create');

      await useCase.removePermission(context, removal);
      await useCase.removePermission(context, removal);
      const { data } = await useCase.getCamsUsers(context, { name: 'Bob', limit: 20, offset: 0 });

      expect(data[0].permissions).not.toContainEqual(
        expect.objectContaining({ id: result.permission.id }),
      );
      expect(auditSpy).toHaveBeenCalledTimes(1);
      expect(auditSpy).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'DEACTIVATED', role: CamsRole.Auditor }),
      );
    });
  });
});
