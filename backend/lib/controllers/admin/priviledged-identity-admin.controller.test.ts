import { createMockApplicationContext } from '../../testing/testing-utilities';
import { AdminUseCase } from '../../use-cases/admin/admin';
import { PriviledgedIdentityAdminController } from './priviledged-identity-admin.controller';
import MockData from '../../../../common/src/cams/test-utilities/mock-data';
import { BadRequestError } from '../../common-errors/bad-request';
import { UnauthorizedError } from '../../common-errors/unauthorized-error';
import { CamsRole } from '../../../../common/src/cams/roles';
import * as featureFlagModule from '../../adapters/utils/feature-flag';

describe('Priviledged identity admin controller tests', () => {
  let controller: PriviledgedIdentityAdminController;

  beforeEach(async () => {
    controller = new PriviledgedIdentityAdminController();
  });

  afterEach(async () => {
    jest.restoreAllMocks();
  });

  test('should not perform operations when the feature flag is disabled', async () => {
    const context = await createMockApplicationContext();
    context.session.user.roles.push(CamsRole.SuperUser);
    context.request.method = 'GET';
    context.request.params.resourceId = 'groups';

    jest.spyOn(featureFlagModule, 'getFeatureFlags').mockResolvedValue({
      'privileged-identity-management': false,
    });

    await expect(controller.handleRequest(context)).rejects.toThrow(
      new UnauthorizedError(expect.anything(), {
        message: 'Priviledged identity management feature is not enabled.',
      }),
    );
  });

  test('should not perform operations when user is not a super admin', async () => {
    const context = await createMockApplicationContext();
    context.session.user.roles = [CamsRole.TrialAttorney];
    context.request.method = 'GET';

    await expect(controller.handleRequest(context)).rejects.toThrow(
      new UnauthorizedError(expect.anything()),
    );
  });

  test('should return a list of group names', async () => {
    const rolesAndOffices = {
      roles: ['name1', 'name2'],
      offices: ['name1', 'name2'],
    };

    const context = await createMockApplicationContext();
    context.session.user.roles.push(CamsRole.SuperUser);
    context.request.method = 'GET';
    context.request.params.resourceId = 'groups';

    jest
      .spyOn(AdminUseCase.prototype, 'getRoleAndOfficeGroupNames')
      .mockResolvedValue(rolesAndOffices);
    const response = await controller.handleRequest(context);
    expect(response).toEqual({
      headers: expect.anything(),
      body: { data: rolesAndOffices },
      statusCode: 200,
    });
  });

  test('should return a list of user references', async () => {
    const users = MockData.buildArray(MockData.getCamsUserReference, 3);

    const context = await createMockApplicationContext();
    context.session.user.roles.push(CamsRole.SuperUser);
    context.request.method = 'GET';

    jest.spyOn(AdminUseCase.prototype, 'getPrivilegedIdentityUsers').mockResolvedValue(users);
    const response = await controller.handleRequest(context);
    expect(response).toEqual({
      headers: expect.anything(),
      body: { data: users },
      statusCode: 200,
    });
  });

  test('should return a priviledged identity user', async () => {
    const user = MockData.getPrivilegedIdentityUser();

    const context = await createMockApplicationContext();
    context.session.user.roles.push(CamsRole.SuperUser);
    context.request.method = 'GET';
    context.request.params.resourceId = 'userId';

    jest.spyOn(AdminUseCase.prototype, 'getPrivilegedIdentityUser').mockResolvedValue(user);
    const response = await controller.handleRequest(context);
    expect(response).toEqual({ headers: expect.anything(), body: { data: user }, statusCode: 200 });
  });

  test('should upsert a priviledged identity user', async () => {
    const context = await createMockApplicationContext();
    context.session.user.roles.push(CamsRole.SuperUser);
    context.request.method = 'PUT';
    context.request.params.resourceId = 'userId';
    context.request.body = {
      groups: ['group1', 'group2'],
      expires: '2025-01-01',
    };

    jest.spyOn(AdminUseCase.prototype, 'upsertPrivilegedIdentityUser').mockResolvedValue();
    const response = await controller.handleRequest(context);
    expect(response).toEqual({ headers: expect.anything(), statusCode: 201 });
  });

  test('should delete a priviledged identity user', async () => {
    const context = await createMockApplicationContext();
    context.session.user.roles.push(CamsRole.SuperUser);
    context.request.method = 'DELETE';
    context.request.params.resourceId = 'userId';
    context.request.body = {
      officeCode: 'TEST_OFFICE_GROUP',
      id: 'user-okta-id',
    };

    jest.spyOn(AdminUseCase.prototype, 'deletePrivilegedIdentityUser').mockResolvedValue();
    const response = await controller.handleRequest(context);
    expect(response).toEqual({ headers: expect.anything(), statusCode: 204 });
  });

  test('should return a bad request for all other requests', async () => {
    const context = await createMockApplicationContext();
    context.session.user.roles.push(CamsRole.SuperUser);
    context.request.method = 'HEAD';

    await expect(controller.handleRequest(context)).rejects.toThrow(
      new BadRequestError(expect.anything(), { message: 'Unsupported HTTP Method' }),
    );
  });
});
