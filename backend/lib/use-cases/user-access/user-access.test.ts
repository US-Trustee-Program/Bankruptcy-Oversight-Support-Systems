import { vi } from 'vitest';
import { ApplicationContext } from '../../adapters/types/basic';
import { createMockApplicationContext, getTheThrownError } from '../../testing/testing-utilities';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import { MockOfficesGateway } from '../../testing/mock-gateways/mock.offices.gateway';
import MockUserGroupGateway from '../../testing/mock-gateways/mock-user-group-gateway';
import { CamsRole } from '@common/cams/roles';
import { getCamsUserReference } from '@common/cams/session';
import { CamsUserReference } from '@common/cams/users';
import {
  RoleAssignmentAuditEntry,
  RoleAssignmentGrantRequest,
  UserRoleAssignment,
} from '@common/cams/user-access';
import {
  MOCKED_USTP_OFFICE_DATA_MAP,
  MOCKED_USTP_OFFICES_ARRAY,
} from '@common/cams/test-utilities/offices.mock';
import { UserAccessUseCase, resetCamsUsersCache } from './user-access';
import { CamsError } from '../../common-errors/cams-error';

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
    expiresAt: null,
    active: true,
    activeKey: `TrialAttorney|${office.regionId}|${office.officeCode}`,
  };
}

function scopedAssignmentFor(userId: string, regionId: string | null): UserRoleAssignment {
  const role = CamsRole.TrialAttorney;
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
        expiresAt: null,
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
    });

    test('should change nothing when the user already holds the permission', async () => {
      spyOnMembers();
      const held = assignmentFor('user-a', MANHATTAN);
      spyOnHeld([assignmentFor('user-a', BUFFALO), held]);
      const { createSpy, traceSpy } = spyOnWrites();

      const outcome = await useCase.grantPermission(context, request);

      expect(outcome).toEqual({ result: { permission: held, replaced: [] }, created: false });
      expect(createSpy).not.toHaveBeenCalled();
      expect(traceSpy).not.toHaveBeenCalled();
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
          { ...manhattan, active: false, activeKey: `inactive|${manhattan.id}` },
          { ...buffalo, active: false, activeKey: `inactive|${buffalo.id}` },
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

        const { result, created } = await useCase.grantPermission(context, {
          ...request,
          ...REGION_2,
        });

        expect(created).toBe(false);
        expect(result.permission).toEqual(regionWide);
        expect(result.replaced.map((p) => p.id)).toEqual([manhattan.id]);
        expect(deactivateSpy).toHaveBeenCalledTimes(1);
        expect(auditWrites(createSpy).map((a) => a.action)).toEqual(['DEACTIVATED']);
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

  describe('getSessionAccess', () => {
    test("should expand the user's active permissions over the live office list", async () => {
      const findSpy = vi
        .spyOn(MockMongoRepository.prototype, 'findActiveByUserIds')
        .mockResolvedValue([
          assignmentFor('user-a', MANHATTAN),
          scopedAssignmentFor('user-a', '18'),
        ]);

      const access = await useCase.getSessionAccess(context, 'user-a');

      const expected = MOCKED_USTP_OFFICES_ARRAY.filter(
        (o) => o.officeCode === MANHATTAN.officeCode || o.regionId === '18',
      ).map((o) => o.officeCode);
      expect(findSpy).toHaveBeenCalledWith(['user-a']);
      expect(access.roles).toEqual([CamsRole.TrialAttorney]);
      expect(access.permissionCount).toBe(2);
      expect(access.offices.map((o) => o.officeCode)).toEqual(expected);
    });

    test('should fail when the permissions cannot be read', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'findActiveByUserIds').mockRejectedValue(
        new Error('cosmos unavailable'),
      );

      await expect(useCase.getSessionAccess(context, 'user-a')).rejects.toThrow(
        'cosmos unavailable',
      );
    });

    test('should fail when the office list cannot be read', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'findActiveByUserIds').mockResolvedValue([]);
      vi.spyOn(MockOfficesGateway.prototype, 'getOffices').mockRejectedValue(
        new Error('dxtr down'),
      );

      await expect(useCase.getSessionAccess(context, 'user-a')).rejects.toThrow('dxtr down');
    });
  });
});
