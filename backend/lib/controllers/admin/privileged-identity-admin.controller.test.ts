import HttpStatusCodes from '../../../../common/src/api/http-status-codes';
import { CamsRole } from '../../../../common/src/cams/roles';
import MockData from '../../../../common/src/cams/test-utilities/mock-data';
import { BadRequestError } from '../../common-errors/bad-request';
import { ForbiddenError } from '../../common-errors/forbidden-error';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { AdminUseCase } from '../../use-cases/admin/admin';
import { PrivilegedIdentityAdminController } from './privileged-identity-admin.controller';

describe('Privileged identity admin controller tests', () => {
  let controller: PrivilegedIdentityAdminController;

  beforeEach(async () => {
    controller = new PrivilegedIdentityAdminController();
  });

  afterEach(async () => {
    jest.restoreAllMocks();
  });

  test('should not perform operations when the feature flag is disabled', async () => {
    const context = await createMockApplicationContext();
    context.session.user.roles.push(CamsRole.SuperUser);
    context.request.method = 'GET';
    context.request.params.resourceId = 'groups';
    context.featureFlags['privileged-identity-management'] = false;

    const expected = expect.objectContaining({
      message: 'Privileged identity management feature is not enabled.',
      status: HttpStatusCodes.FORBIDDEN,
    });
    await expect(controller.handleRequest(context)).rejects.toThrow(expected);
  });

  test('should not perform operations when user is not a super admin', async () => {
    const context = await createMockApplicationContext();
    context.session.user.roles = [CamsRole.TrialAttorney];
    context.request.method = 'GET';
    context.featureFlags['privileged-identity-management'] = true;

    await expect(controller.handleRequest(context)).rejects.toThrow(
      new ForbiddenError(expect.anything()),
    );
  });

  test('should return a list of group names', async () => {
    const rolesAndOffices = {
      offices: ['name1', 'name2'],
      roles: ['name1', 'name2'],
    };

    const context = await createMockApplicationContext();
    context.session.user.roles.push(CamsRole.SuperUser);
    context.request.method = 'GET';
    context.request.params.resourceId = 'groups';
    context.featureFlags['privileged-identity-management'] = true;

    jest
      .spyOn(AdminUseCase.prototype, 'getRoleAndOfficeGroupNames')
      .mockResolvedValue(rolesAndOffices);
    const response = await controller.handleRequest(context);
    expect(response).toEqual({
      body: { data: rolesAndOffices },
      headers: expect.anything(),
      statusCode: 200,
    });
  });

  test('should return a list of user references', async () => {
    const users = MockData.buildArray(MockData.getCamsUserReference, 3);

    const context = await createMockApplicationContext();
    context.session.user.roles.push(CamsRole.SuperUser);
    context.request.method = 'GET';
    context.featureFlags['privileged-identity-management'] = true;

    jest.spyOn(AdminUseCase.prototype, 'getPrivilegedIdentityUsers').mockResolvedValue(users);
    const response = await controller.handleRequest(context);
    expect(response).toEqual({
      body: { data: users },
      headers: expect.anything(),
      statusCode: 200,
    });
  });

  test('should return a privileged identity user', async () => {
    const user = MockData.getPrivilegedIdentityUser();

    const context = await createMockApplicationContext();
    context.session.user.roles.push(CamsRole.SuperUser);
    context.request.method = 'GET';
    context.request.params.resourceId = 'userId';
    context.featureFlags['privileged-identity-management'] = true;

    jest.spyOn(AdminUseCase.prototype, 'getPrivilegedIdentityUser').mockResolvedValue(user);
    const response = await controller.handleRequest(context);
    expect(response).toEqual({ body: { data: user }, headers: expect.anything(), statusCode: 200 });
  });

  test('should upsert a privileged identity user', async () => {
    const context = await createMockApplicationContext();
    context.session.user.roles.push(CamsRole.SuperUser);
    context.request.method = 'PUT';
    context.request.params.resourceId = 'userId';
    context.request.body = {
      expires: '2025-01-01',
      groups: ['group1', 'group2'],
    };
    context.featureFlags['privileged-identity-management'] = true;

    jest.spyOn(AdminUseCase.prototype, 'elevatePrivilegedUser').mockResolvedValue();
    const response = await controller.handleRequest(context);
    expect(response).toEqual({ headers: expect.anything(), statusCode: 201 });
  });

  test('should delete a privileged identity user', async () => {
    const context = await createMockApplicationContext();
    context.session.user.roles.push(CamsRole.SuperUser);
    context.request.method = 'DELETE';
    context.request.params.resourceId = 'userId';
    context.request.body = {
      id: 'user-okta-id',
      officeCode: 'TEST_OFFICE_GROUP',
    };
    context.featureFlags['privileged-identity-management'] = true;

    jest.spyOn(AdminUseCase.prototype, 'deletePrivilegedIdentityUser').mockResolvedValue();
    const response = await controller.handleRequest(context);
    expect(response).toEqual({ headers: expect.anything(), statusCode: 204 });
  });

  test('should return a bad request for all other requests', async () => {
    const context = await createMockApplicationContext();
    context.session.user.roles.push(CamsRole.SuperUser);
    context.request.method = 'HEAD';
    context.featureFlags['privileged-identity-management'] = true;

    await expect(controller.handleRequest(context)).rejects.toThrow(
      new BadRequestError(expect.anything(), { message: 'Unsupported HTTP Method' }),
    );
  });
});
