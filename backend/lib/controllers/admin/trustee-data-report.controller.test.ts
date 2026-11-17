import { vi } from 'vitest';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { TrusteeDataReportController } from './trustee-data-report.controller';
import * as StartUseCase from '../../use-cases/trustee-data-report/start-trustee-data-report';
import * as GetLatestUseCase from '../../use-cases/trustee-data-report/get-latest-trustee-data-report';
import { CamsRole, CamsRoleType } from '@common/cams/roles';
import { CamsHttpMethod } from '../../adapters/types/http';
import { ForbiddenError } from '../../common-errors/forbidden-error';
import { ConflictError } from '../../common-errors/conflict-error';
import HttpStatusCodes from '@common/api/http-status-codes';
import { TrusteeDataReportRun } from '@common/cams/trustee-data-report';
import { ApplicationContext } from '../../adapters/types/basic';

const QUEUED_RUN: TrusteeDataReportRun = {
  runId: 'run-1',
  status: 'queued',
  startedBy: { id: 'user-1', name: 'Test SuperUser' },
  queuedAt: '2026-11-17T10:00:00.000Z',
};

describe('Trustee Data Report Controller tests', () => {
  let controller: TrusteeDataReportController;

  async function contextFor(
    method: CamsHttpMethod,
    roles: CamsRoleType[],
  ): Promise<ApplicationContext> {
    const context = await createMockApplicationContext();
    context.session.user.roles = roles;
    context.request.method = method;
    return context;
  }

  beforeEach(() => {
    controller = new TrusteeDataReportController();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test.each<CamsHttpMethod>(['GET', 'POST'])(
    'should reject %s when the user is not a SuperUser',
    async (method) => {
      const start = vi.spyOn(StartUseCase, 'startTrusteeDataReport');
      const getLatest = vi.spyOn(GetLatestUseCase, 'getLatestTrusteeDataReport');
      const context = await contextFor(method, [CamsRole.TrialAttorney]);

      await expect(controller.handleRequest(context)).rejects.toThrow(
        new ForbiddenError(expect.anything()),
      );
      expect(start).not.toHaveBeenCalled();
      expect(getLatest).not.toHaveBeenCalled();
    },
  );

  test('should start a run on POST and return it with 201', async () => {
    vi.spyOn(StartUseCase, 'startTrusteeDataReport').mockResolvedValue(QUEUED_RUN);
    const context = await contextFor('POST', [CamsRole.SuperUser]);

    const response = await controller.handleRequest(context);

    expect(response.statusCode).toBe(HttpStatusCodes.CREATED);
    expect(response.body).toEqual({ data: QUEUED_RUN });
  });

  test('should return 409 on POST while another run is active', async () => {
    vi.spyOn(StartUseCase, 'startTrusteeDataReport').mockRejectedValue(
      new ConflictError('TEST', { message: 'A trustee data report is already running.' }),
    );
    const context = await contextFor('POST', [CamsRole.SuperUser]);

    await expect(controller.handleRequest(context)).rejects.toThrow(
      expect.objectContaining({ status: HttpStatusCodes.CONFLICT }),
    );
  });

  test('should return the active and latest completed runs on GET', async () => {
    const latest = { latestCompletedRun: { ...QUEUED_RUN, status: 'completed' as const } };
    vi.spyOn(GetLatestUseCase, 'getLatestTrusteeDataReport').mockResolvedValue(latest);
    const context = await contextFor('GET', [CamsRole.SuperUser]);

    const response = await controller.handleRequest(context);

    expect(response.statusCode).toBe(HttpStatusCodes.OK);
    expect(response.body).toEqual({ data: latest });
  });

  test('should reject unsupported methods', async () => {
    const context = await contextFor('PUT', [CamsRole.SuperUser]);

    await expect(controller.handleRequest(context)).rejects.toThrow(
      expect.objectContaining({
        status: HttpStatusCodes.BAD_REQUEST,
        message: 'Unsupported HTTP Method',
      }),
    );
  });
});
