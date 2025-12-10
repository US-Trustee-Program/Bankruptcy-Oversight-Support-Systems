import { vi } from 'vitest';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { AdminUseCase } from '../../use-cases/admin/admin';
import { PrivilegedIdentityAdminController } from './privileged-identity-admin.controller';
import MockData from '../../../../common/src/cams/test-utilities/mock-data';
import { BadRequestError } from '../../common-errors/bad-request';
import { CamsRole } from '../../../../common/src/cams/roles';
import { ForbiddenError } from '../../common-errors/forbidden-error';
import HttpStatusCodes from '../../../../common/src/api/http-status-codes';

describe('Privileged identity admin controller tests', () => {
  let controller: PrivilegedIdentityAdminController;

  beforeEach(async () => {
    controller = new PrivilegedIdentityAdminController();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
  });

  test('should not perform operations when the feature flag is disabled', async () => {
    const context = await createMockApplicationContext();
    context.session.user.roles.push(CamsRole.SuperUser);
    context.request.method = 'GET';
    context.request.params.resourceId = 'groups';
    context.featureFlags['privileged-identity-management'] = false;

    const expected = expect.objectContaining({
      status: HttpStatusCodes.FORBIDDEN,
      message: 'Privileged identity management feature is not enabled.',
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
      roles: ['name1', 'name2'],
      offices: ['name1', 'name2'],
    };

    const context = await createMockApplicationContext();
    context.session.user.roles.push(CamsRole.SuperUser);
    context.request.method = 'GET';
    context.request.params.resourceId = 'groups';
    context.featureFlags['privileged-identity-management'] = true;

    vi.spyOn(AdminUseCase.prototype, 'getRoleAndOfficeGroupNames').mockResolvedValue(
      rolesAndOffices,
    );
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
    context.featureFlags['privileged-identity-management'] = true;

    vi.spyOn(AdminUseCase.prototype, 'getPrivilegedIdentityUsers').mockResolvedValue(users);
    const response = await controller.handleRequest(context);
    expect(response).toEqual({
      headers: expect.anything(),
      body: { data: users },
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

    vi.spyOn(AdminUseCase.prototype, 'getPrivilegedIdentityUser').mockResolvedValue(user);
    const response = await controller.handleRequest(context);
    expect(response).toEqual({ headers: expect.anything(), body: { data: user }, statusCode: 200 });
  });

  test('should upsert a privileged identity user', async () => {
    const context = await createMockApplicationContext();
    context.session.user.roles.push(CamsRole.SuperUser);
    context.request.method = 'PUT';
    context.request.params.resourceId = 'userId';
    context.request.body = {
      groups: ['group1', 'group2'],
      expires: '2025-01-01',
    };
    context.featureFlags['privileged-identity-management'] = true;

    vi.spyOn(AdminUseCase.prototype, 'elevatePrivilegedUser').mockResolvedValue();
    const response = await controller.handleRequest(context);
    expect(response).toEqual({ headers: expect.anything(), statusCode: 201 });
  });

  test('should delete a privileged identity user', async () => {
    const context = await createMockApplicationContext();
    context.session.user.roles.push(CamsRole.SuperUser);
    context.request.method = 'DELETE';
    context.request.params.resourceId = 'userId';
    context.request.body = {
      officeCode: 'TEST_OFFICE_GROUP',
      id: 'user-okta-id',
    };
    context.featureFlags['privileged-identity-management'] = true;

    vi.spyOn(AdminUseCase.prototype, 'deletePrivilegedIdentityUser').mockResolvedValue();
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
