import { vi } from 'vitest';
import { ApplicationContext } from '../../adapters/types/basic';
import { createMockApplicationContext, getTheThrownError } from '../../testing/testing-utilities';
import { UserAccessController } from './user-access.controller';
import { UserAccessUseCase } from '../../use-cases/user-access/user-access';
import { CamsRole } from '@common/cams/roles';
import { CamsUserWithPermissions, UserRoleAssignment } from '@common/cams/user-access';
import { BadRequestError } from '../../common-errors/bad-request';
import * as FinalizeDeferrableModule from '../../deferrable/finalize-deferrable';

describe('UserAccessController', () => {
  let context: ApplicationContext;

  const users: CamsUserWithPermissions[] = [
    { id: 'user-a', name: 'Alice Adams', email: 'alice@example.com', permissions: [] },
  ];

  const assignment = {
    documentType: 'USER_ROLE_ASSIGNMENT',
    id: 'assignment-1',
    userId: 'user-a',
  } as UserRoleAssignment;

  beforeEach(async () => {
    vi.restoreAllMocks();
    context = await createMockApplicationContext();
    context.featureFlags['cams-role-assignments'] = true;
    context.session.user.roles = [CamsRole.SuperUser];
    context.request.method = 'GET';
    context.request.params = { resource: 'users' };
    context.request.query = {};
    context.request.url = 'http://localhost/api/user-access/users';
  });

  async function handle() {
    return new UserAccessController(context).handleRequest(context);
  }

  describe('access', () => {
    test.each([
      {
        case: 'the cams-role-assignments flag is off',
        setup: () => (context.featureFlags['cams-role-assignments'] = false),
      },
      {
        case: 'the user is not a SuperUser',
        setup: () => (context.session.user.roles = [CamsRole.CaseAssignmentManager]),
      },
      { case: 'the user has no roles', setup: () => (context.session.user.roles = undefined) },
    ])('should return 403 when $case', async ({ setup }) => {
      setup();
      const getSpy = vi.spyOn(UserAccessUseCase.prototype, 'getCamsUsers');
      const createSpy = vi.spyOn(UserAccessUseCase.prototype, 'createAssignment');

      for (const [method, resource] of [
        ['GET', 'users'],
        ['POST', 'assignments'],
      ]) {
        context.request.method = method as 'GET' | 'POST';
        context.request.params = { resource };
        const error = await getTheThrownError(handle);
        expect(error).toEqual(expect.objectContaining({ status: 403 }));
      }
      expect(getSpy).not.toHaveBeenCalled();
      expect(createSpy).not.toHaveBeenCalled();
    });
  });

  describe('GET users', () => {
    test('should default to 20 users from the start and return pagination', async () => {
      const spy = vi
        .spyOn(UserAccessUseCase.prototype, 'getCamsUsers')
        .mockResolvedValue({ data: users, totalCount: 41 });

      const response = await handle();

      expect(spy).toHaveBeenCalledWith(context, {
        limit: 20,
        offset: 0,
        name: undefined,
        email: undefined,
      });
      expect(response.statusCode).toEqual(200);
      expect(response.body).toEqual({
        meta: { self: 'http://localhost/api/user-access/users' },
        pagination: { count: 1, totalCount: 41, currentPage: 1, totalPages: 3, limit: 20 },
        data: users,
      });
    });

    test('should pass the paging and filter query parameters through', async () => {
      context.request.query = { limit: '10', offset: '30', name: 'ali', email: 'example' };
      const spy = vi
        .spyOn(UserAccessUseCase.prototype, 'getCamsUsers')
        .mockResolvedValue({ data: users, totalCount: 41 });

      const response = await handle();

      expect(spy).toHaveBeenCalledWith(context, {
        limit: 10,
        offset: 30,
        name: 'ali',
        email: 'example',
      });
      expect(response.body.pagination).toEqual(
        expect.objectContaining({ currentPage: 4, totalPages: 5, limit: 10 }),
      );
    });

    test.each([
      {
        query: { name: '  sarah ', email: '\tsarah@example.com\n' },
        name: 'sarah',
        email: 'sarah@example.com',
      },
      { query: { name: '   ', email: '' }, name: undefined, email: undefined },
    ])(
      'should trim the filters and treat blank ones as absent for $query',
      async ({ query, name, email }) => {
        context.request.query = query;
        const spy = vi
          .spyOn(UserAccessUseCase.prototype, 'getCamsUsers')
          .mockResolvedValue({ data: [], totalCount: 0 });

        await handle();

        expect(spy).toHaveBeenCalledWith(context, expect.objectContaining({ name, email }));
      },
    );

    test.each([
      { query: { limit: 'abc', offset: 'xyz' } },
      { query: { limit: '0', offset: '-5' } },
    ])('should fall back to the defaults for invalid paging $query', async ({ query }) => {
      context.request.query = query;
      const spy = vi
        .spyOn(UserAccessUseCase.prototype, 'getCamsUsers')
        .mockResolvedValue({ data: [], totalCount: 0 });

      await handle();

      expect(spy).toHaveBeenCalledWith(context, expect.objectContaining({ limit: 20, offset: 0 }));
    });
  });

  describe('POST assignments', () => {
    test('should create the assignment and respond 201 with it', async () => {
      const body = {
        userId: 'user-a',
        role: CamsRole.TrialAttorney,
        officeCode: 'USTP_CAMS_Region_2_Office_Manhattan',
        reason: 'New hire',
      };
      context.request.method = 'POST';
      context.request.params = { resource: 'assignments' };
      context.request.body = body;
      const spy = vi
        .spyOn(UserAccessUseCase.prototype, 'createAssignment')
        .mockResolvedValue(assignment);

      const response = await handle();

      expect(spy).toHaveBeenCalledWith(context, body);
      expect(response.statusCode).toEqual(201);
      expect(response.body).toEqual({ data: assignment });
    });

    test('should pass through a 400 from the use case', async () => {
      context.request.method = 'POST';
      context.request.params = { resource: 'assignments' };
      context.request.body = {};
      vi.spyOn(UserAccessUseCase.prototype, 'createAssignment').mockRejectedValue(
        new BadRequestError('USER-ACCESS-USE-CASE', { message: 'A reason is required.' }),
      );

      const error = await getTheThrownError(handle);

      expect(error).toEqual(
        expect.objectContaining({ status: 400, message: 'A reason is required.' }),
      );
    });
  });

  test.each([
    { method: 'POST', resource: 'users' },
    { method: 'GET', resource: 'assignments' },
    { method: 'DELETE', resource: 'users' },
    { method: 'GET', resource: 'other' },
  ])('should return 400 for $method $resource', async ({ method, resource }) => {
    context.request.method = method as 'GET';
    context.request.params = { resource };

    const error = await getTheThrownError(handle);

    expect(error).toEqual(expect.objectContaining({ status: 400 }));
  });

  test('should finalize deferred resources whether or not the request succeeds', async () => {
    const finalizeSpy = vi.spyOn(FinalizeDeferrableModule, 'finalizeDeferrable');
    vi.spyOn(UserAccessUseCase.prototype, 'getCamsUsers').mockResolvedValue({
      data: [],
      totalCount: 0,
    });

    await handle();
    context.session.user.roles = [];
    await getTheThrownError(handle);

    expect(finalizeSpy).toHaveBeenCalledTimes(2);
  });
});
