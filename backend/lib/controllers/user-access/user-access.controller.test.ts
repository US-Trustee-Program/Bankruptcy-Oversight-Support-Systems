import { vi } from 'vitest';
import { ApplicationContext } from '../../adapters/types/basic';
import { createMockApplicationContext, getTheThrownError } from '../../testing/testing-utilities';
import { UserAccessController } from './user-access.controller';
import { UserAccessUseCase } from '../../use-cases/user-access/user-access';
import { CamsRole } from '@common/cams/roles';
import { CamsUserWithPermissions, UserRoleAssignment } from '@common/cams/user-access';
import { BadRequestError } from '../../common-errors/bad-request';
import * as FinalizeDeferrableModule from '../../deferrable/finalize-deferrable';

const GRANT_PARAMS = {
  userId: 'user-a',
  role: CamsRole.TrialAttorney,
  regionId: '2',
  officeCode: 'USTP_CAMS_Region_2_Office_Manhattan',
};

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
      const grantSpy = vi.spyOn(UserAccessUseCase.prototype, 'grantPermission');

      for (const [method, params] of [
        ['GET', { resource: 'users' }],
        ['PUT', GRANT_PARAMS],
      ] as const) {
        context.request.method = method;
        context.request.params = { ...params };
        const error = await getTheThrownError(handle);
        expect(error).toEqual(expect.objectContaining({ status: 403 }));
      }
      expect(getSpy).not.toHaveBeenCalled();
      expect(grantSpy).not.toHaveBeenCalled();
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

  describe('PUT a permission', () => {
    const permission = assignment;

    beforeEach(() => {
      context.request.method = 'PUT';
      context.request.params = { ...GRANT_PARAMS };
    });

    test('should grant the permission named by the path', async () => {
      const spy = vi
        .spyOn(UserAccessUseCase.prototype, 'grantPermission')
        .mockResolvedValue({ result: { permission, replaced: [] }, created: true });

      await handle();

      expect(spy).toHaveBeenCalledWith(context, GRANT_PARAMS);
    });

    test.each([
      { created: true, statusCode: 201 },
      { created: false, statusCode: 200 },
    ])(
      'should respond $statusCode with the result when created is $created',
      async ({ created, statusCode }) => {
        vi.spyOn(UserAccessUseCase.prototype, 'grantPermission').mockResolvedValue({
          result: { permission, replaced: [] },
          created,
        });

        const response = await handle();

        expect(response.statusCode).toEqual(statusCode);
        expect(response.body).toEqual({ data: { permission, replaced: [] } });
      },
    );

    test('should pass through a 400 from the use case', async () => {
      vi.spyOn(UserAccessUseCase.prototype, 'grantPermission').mockRejectedValue(
        new BadRequestError('USER-ACCESS-USE-CASE', { message: 'A user is required.' }),
      );

      const error = await getTheThrownError(handle);

      expect(error).toEqual(
        expect.objectContaining({ status: 400, message: 'A user is required.' }),
      );
    });
  });

  test('should report an unexpected use-case failure as a 500 from this controller', async () => {
    vi.spyOn(UserAccessUseCase.prototype, 'getCamsUsers').mockRejectedValue(new Error('boom'));

    const error = await getTheThrownError(handle);

    expect(error).toEqual(
      expect.objectContaining({ status: 500, module: 'USER-ACCESS-CONTROLLER' }),
    );
  });

  test.each([
    { method: 'POST', params: { resource: 'assignments' } },
    { method: 'POST', params: { resource: 'users' } },
    { method: 'PUT', params: { resource: 'users' } },
    { method: 'GET', params: GRANT_PARAMS },
    { method: 'DELETE', params: { resource: 'users' } },
    { method: 'GET', params: { resource: 'other' } },
  ])('should return 400 for $method $params', async ({ method, params }) => {
    context.request.method = method as 'GET';
    context.request.params = { ...params };
    const listSpy = vi.spyOn(UserAccessUseCase.prototype, 'getCamsUsers');
    const grantSpy = vi.spyOn(UserAccessUseCase.prototype, 'grantPermission');

    const error = await getTheThrownError(handle);

    expect(error).toEqual(
      expect.objectContaining({ status: 400, message: 'Unsupported HTTP Method' }),
    );
    expect(listSpy).not.toHaveBeenCalled();
    expect(grantSpy).not.toHaveBeenCalled();
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
