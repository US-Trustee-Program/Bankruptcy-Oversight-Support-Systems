import { vi } from 'vitest';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { CaseReloadController } from './case-reload.controller';
import CaseReloadUseCase from '../../use-cases/admin/case-reload';
import { CamsRole } from '@common/cams/roles';
import { ForbiddenError } from '../../common-errors/forbidden-error';
import HttpStatusCodes from '@common/api/http-status-codes';

describe('Case Reload Controller tests', () => {
  let controller: CaseReloadController;

  beforeEach(async () => {
    controller = new CaseReloadController();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
  });

  test('should reject request when user is not a SuperUser', async () => {
    const context = await createMockApplicationContext();
    context.session.user.roles = [CamsRole.TrialAttorney];
    context.request.method = 'POST';
    context.request.body = { caseId: '081-12-34567' };

    await expect(controller.handleRequest(context)).rejects.toThrow(
      new ForbiddenError(expect.anything()),
    );
  });

  test('should reject non-POST requests', async () => {
    const context = await createMockApplicationContext();
    context.session.user.roles.push(CamsRole.SuperUser);
    context.request.method = 'GET';

    const expected = expect.objectContaining({
      status: HttpStatusCodes.BAD_REQUEST,
      message: 'Unsupported HTTP Method',
    });
    await expect(controller.handleRequest(context)).rejects.toThrow(expected);
  });

  test('should reject request without caseId', async () => {
    const context = await createMockApplicationContext();
    context.session.user.roles.push(CamsRole.SuperUser);
    context.request.method = 'POST';
    context.request.body = {};

    const expected = expect.objectContaining({
      status: HttpStatusCodes.BAD_REQUEST,
      message: 'caseId is required',
    });
    await expect(controller.handleRequest(context)).rejects.toThrow(expected);
  });

  test('should reject request with empty caseId', async () => {
    const context = await createMockApplicationContext();
    context.session.user.roles.push(CamsRole.SuperUser);
    context.request.method = 'POST';
    context.request.body = { caseId: '   ' };

    const expected = expect.objectContaining({
      status: HttpStatusCodes.BAD_REQUEST,
      message: 'caseId is required',
    });
    await expect(controller.handleRequest(context)).rejects.toThrow(expected);
  });

  test('should reject request with non-string caseId', async () => {
    const context = await createMockApplicationContext();
    context.session.user.roles.push(CamsRole.SuperUser);
    context.request.method = 'POST';
    context.request.body = { caseId: 123 };

    const expected = expect.objectContaining({
      status: HttpStatusCodes.BAD_REQUEST,
      message: 'caseId is required',
    });
    await expect(controller.handleRequest(context)).rejects.toThrow(expected);
  });

  test('should queue case reload and return 201 on success', async () => {
    const context = await createMockApplicationContext();
    context.session.user.roles.push(CamsRole.SuperUser);
    context.request.method = 'POST';
    const caseId = '081-12-34567';
    context.request.body = { caseId };

    const queueCaseReloadSpy = vi.spyOn(CaseReloadUseCase, 'queueCaseReload').mockResolvedValue();

    const response = await controller.handleRequest(context);

    expect(queueCaseReloadSpy).toHaveBeenCalledWith(context, caseId);
    expect(response).toEqual({
      headers: expect.anything(),
      statusCode: 201,
    });
  });
});
