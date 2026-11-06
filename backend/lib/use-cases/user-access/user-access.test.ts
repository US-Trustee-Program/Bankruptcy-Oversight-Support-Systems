import { vi } from 'vitest';
import { ApplicationContext } from '../../adapters/types/basic';
import { createMockApplicationContext, getTheThrownError } from '../../testing/testing-utilities';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import MockUserGroupGateway from '../../testing/mock-gateways/mock-user-group-gateway';
import { CamsRole } from '@common/cams/roles';
import { getCamsUserReference } from '@common/cams/session';
import { CamsUserReference } from '@common/cams/users';
import {
  RoleAssignmentAuditEntry,
  RoleAssignmentGrantRequest,
  UserRoleAssignment,
} from '@common/cams/user-access';
import { MOCKED_USTP_OFFICE_DATA_MAP } from '@common/cams/test-utilities/offices.mock';
import { UserAccessUseCase, resetCamsUsersCache } from './user-access';
import { BadRequestError } from '../../common-errors/bad-request';

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

  describe('createAssignment', () => {
    const request: RoleAssignmentGrantRequest = {
      userId: 'user-a',
      role: CamsRole.TrialAttorney,
      officeCode: MANHATTAN.officeCode,
      reason: '  New hire in Manhattan  ',
    };

    function spyOnWrites() {
      return {
        createSpy: vi
          .spyOn(MockMongoRepository.prototype, 'create')
          .mockImplementation((item) => Promise.resolve(item)),
        traceSpy: vi.spyOn(context.observability, 'completeTrace'),
      };
    }

    test('should write the assignment, then its audit record, then a telemetry event', async () => {
      spyOnMembers();
      const { createSpy, traceSpy } = spyOnWrites();
      const performer = getCamsUserReference(context.session.user);

      const result = await useCase.createAssignment(context, request);

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
      const expectedAudit: RoleAssignmentAuditEntry = {
        documentType: 'ROLE_ASSIGNMENT_AUDIT',
        id: expect.any(String),
        assignmentId: result.id,
        action: 'CREATED',
        userId: 'user-a',
        userName: 'Alice Adams',
        role: CamsRole.TrialAttorney,
        regionId: MANHATTAN.regionId,
        officeCode: MANHATTAN.officeCode,
        performedBy: performer.id,
        performedByName: performer.name,
        performedAt: result.assignedAt,
        previousState: null,
        newState: {
          role: CamsRole.TrialAttorney,
          regionId: MANHATTAN.regionId,
          officeCode: MANHATTAN.officeCode,
          active: true,
        },
        reason: 'New hire in Manhattan',
      };

      expect(result).toEqual(expectedAssignment);
      expect(createSpy).toHaveBeenCalledTimes(2);
      expect(createSpy).toHaveBeenNthCalledWith(1, expectedAssignment);
      expect(createSpy).toHaveBeenNthCalledWith(2, expectedAudit);
      expect(createSpy.mock.calls[1][0].id).not.toEqual(result.id);
      expect(traceSpy).toHaveBeenCalledWith(
        expect.anything(),
        'RoleAssignmentAudit',
        expect.objectContaining({
          success: true,
          properties: expect.objectContaining({
            action: 'CREATED',
            assignmentId: result.id,
            userId: 'user-a',
            role: CamsRole.TrialAttorney,
            regionId: MANHATTAN.regionId,
            officeCode: MANHATTAN.officeCode,
            performedBy: performer.id,
            reason: 'New hire in Manhattan',
          }),
        }),
        undefined,
        expect.anything(),
      );
    });

    test('should take the performer from the session, never from the request body', async () => {
      spyOnMembers();
      const { createSpy } = spyOnWrites();
      const forged = {
        ...request,
        assignedBy: 'attacker',
        performedBy: 'attacker',
        regionId: '99',
        activeKey: 'forged',
      };

      const result = await useCase.createAssignment(context, forged);

      expect(result.assignedBy).toEqual(context.session.user.id);
      expect(createSpy.mock.calls[1][0].performedBy).toEqual(context.session.user.id);
      expect(result).not.toHaveProperty('performedBy');
      expect(result.regionId).toEqual(MANHATTAN.regionId);
      expect(result.activeKey).toEqual(
        `TrialAttorney|${MANHATTAN.regionId}|${MANHATTAN.officeCode}`,
      );
    });

    test.each([
      { case: 'an invalid request', change: { reason: '   ' }, message: /reason is required/ },
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
    ])('should reject $case with a 400 and write nothing', async ({ change, message }) => {
      spyOnMembers();
      const { createSpy, traceSpy } = spyOnWrites();

      const error = await getTheThrownError(() =>
        useCase.createAssignment(context, { ...request, ...change }),
      );

      expect(error).toEqual(expect.objectContaining({ status: 400 }));
      expect(error.message).toMatch(message);
      expect(createSpy).not.toHaveBeenCalled();
      expect(traceSpy).not.toHaveBeenCalled();
    });

    test('should reject a missing request body with a 400 that says why', async () => {
      const error = await getTheThrownError(() =>
        useCase.createAssignment(context, undefined as unknown as RoleAssignmentGrantRequest),
      );

      expect(error).toEqual(
        expect.objectContaining({ status: 400, message: 'Value must be an object.' }),
      );
    });

    test('should keep the grant and log a searchable error with the audit payload when the audit write fails', async () => {
      spyOnMembers();
      const { createSpy, traceSpy } = spyOnWrites();
      createSpy
        .mockImplementationOnce((item) => Promise.resolve(item))
        .mockRejectedValueOnce(new Error('cosmos unavailable'));
      const errorSpy = vi.spyOn(context.logger, 'error');

      const result = await useCase.createAssignment(context, request);

      const attemptedAudit = createSpy.mock.calls[1][0];
      expect(result).toEqual(createSpy.mock.calls[0][0]);
      expect(attemptedAudit).toEqual(
        expect.objectContaining({ assignmentId: result.id, reason: 'New hire in Manhattan' }),
      );
      expect(errorSpy).toHaveBeenCalledWith(
        'USER-ACCESS-USE-CASE',
        expect.stringContaining('ROLE_ASSIGNMENT_AUDIT write failed'),
        { audit: attemptedAudit },
      );
      // The telemetry event still records the grant.
      expect(traceSpy).toHaveBeenCalled();
    });

    test('should keep the grant and log when the telemetry event fails', async () => {
      spyOnMembers();
      spyOnWrites().traceSpy.mockImplementation(() => {
        throw new Error('telemetry down');
      });
      const errorSpy = vi.spyOn(context.logger, 'error');

      const result = await useCase.createAssignment(context, request);

      expect(result.userId).toEqual('user-a');
      expect(errorSpy).toHaveBeenCalledWith(
        'USER-ACCESS-USE-CASE',
        expect.stringContaining('telemetry'),
        expect.anything(),
      );
    });

    test('should write no audit record or telemetry when the assignment write fails', async () => {
      spyOnMembers();
      const { createSpy, traceSpy } = spyOnWrites();
      createSpy.mockRejectedValue(
        new BadRequestError('X', { message: 'This user already has that permission.' }),
      );

      await expect(useCase.createAssignment(context, request)).rejects.toThrow(
        'This user already has that permission.',
      );
      expect(createSpy).toHaveBeenCalledTimes(1);
      expect(traceSpy).not.toHaveBeenCalled();
    });
  });
});
