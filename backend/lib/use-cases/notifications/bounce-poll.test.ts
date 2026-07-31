import { vi } from 'vitest';
import {
  LogsQueryClient,
  LogsQueryResultStatus,
  LogsQueryResult,
  LogsColumn,
} from '@azure/monitor-query-logs';
import { ApplicationContext } from '../../adapters/types/basic';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { BouncePollUseCase } from './bounce-poll';
import { BounceReconstructionUseCase } from './bounce-reconstruction';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import { AcsBouncePollState } from '../gateways.types';
import { NotFoundError } from '../../common-errors/not-found-error';

const MODULE_NAME = 'RUNTIME-STATE-MONGO-REPOSITORY';

const COLUMN_DESCRIPTORS: LogsColumn[] = [
  { name: 'TimeGenerated', type: 'datetime' },
  { name: 'MessageId', type: 'string' },
  { name: 'RecipientId', type: 'string' },
  { name: 'DeliveryStatus', type: 'string' },
];

function mockQueryResult(rows: unknown[][]): LogsQueryResult {
  return {
    status: LogsQueryResultStatus.Success,
    tables: [
      {
        name: 'PrimaryResult',
        columnDescriptors: COLUMN_DESCRIPTORS,
        rows,
      },
    ],
  };
}

describe('BouncePollUseCase', () => {
  let context: ApplicationContext;
  let useCase: BouncePollUseCase;

  beforeEach(async () => {
    vi.restoreAllMocks();
    context = await createMockApplicationContext({
      env: {
        ANALYTICS_WORKSPACE_CUSTOMER_ID: 'workspace-guid',
        ADMIN_NOTIFICATION_EMAIL: 'admin@example.test',
      },
    });
    useCase = new BouncePollUseCase();
  });

  test('throws ServerConfigError when required env vars are missing', async () => {
    delete process.env.ANALYTICS_WORKSPACE_CUSTOMER_ID;

    await expect(useCase.pollAndReconstruct(context)).rejects.toThrow(
      expect.objectContaining({ status: 500 }),
    );
  });

  test('propagates non-not-found errors from reading poll state instead of resetting the cursor', async () => {
    const connectivityError = new Error('connection refused');
    vi.spyOn(MockMongoRepository.prototype, 'read').mockRejectedValue(connectivityError);
    const queryWorkspaceSpy = vi.spyOn(LogsQueryClient.prototype, 'queryWorkspace');

    await expect(useCase.pollAndReconstruct(context)).rejects.toThrow(connectivityError);
    expect(queryWorkspaceSpy).not.toHaveBeenCalled();
  });

  test('returns zero counts and does not query state when no rows are found', async () => {
    vi.spyOn(MockMongoRepository.prototype, 'read').mockRejectedValue(
      new NotFoundError(MODULE_NAME, { message: 'No matching item found.' }),
    );
    vi.spyOn(LogsQueryClient.prototype, 'queryWorkspace').mockResolvedValue(mockQueryResult([]));
    const upsertSpy = vi.spyOn(MockMongoRepository.prototype, 'upsert');

    const summary = await useCase.pollAndReconstruct(context);

    expect(summary).toEqual({ found: 0, reconstructed: 0, failed: 0 });
    expect(upsertSpy).not.toHaveBeenCalled();
  });

  test('reconstructs each bounce row found and advances the cursor to the latest TimeGenerated', async () => {
    vi.spyOn(MockMongoRepository.prototype, 'read').mockRejectedValue(
      new NotFoundError(MODULE_NAME, { message: 'No matching item found.' }),
    );
    vi.spyOn(LogsQueryClient.prototype, 'queryWorkspace').mockResolvedValue(
      mockQueryResult([
        ['2026-01-05T00:00:00.000Z', 'msg-1', 'ch-oversight@example.test', 'Bounced'],
        ['2026-01-06T00:00:00.000Z', 'msg-2', 'zoom-341@example.test', 'Failed'],
      ]),
    );
    const reconstructSpy = vi
      .spyOn(BounceReconstructionUseCase.prototype, 'reconstructAndForward')
      .mockResolvedValue(undefined);
    const upsertSpy = vi
      .spyOn(MockMongoRepository.prototype, 'upsert')
      .mockResolvedValue(expect.anything());

    const summary = await useCase.pollAndReconstruct(context);

    expect(summary).toEqual({ found: 2, reconstructed: 2, failed: 0 });
    expect(reconstructSpy).toHaveBeenCalledWith(context, 'msg-1', 'admin@example.test');
    expect(reconstructSpy).toHaveBeenCalledWith(context, 'msg-2', 'admin@example.test');
    expect(upsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        documentType: 'ACS_BOUNCE_POLL_STATE',
        lastProcessedTimeGenerated: '2026-01-06T00:00:00.000Z',
      }),
    );
  });

  test('continues processing remaining rows and reports failures when one reconstruction fails', async () => {
    vi.spyOn(MockMongoRepository.prototype, 'read').mockRejectedValue(
      new NotFoundError(MODULE_NAME, { message: 'No matching item found.' }),
    );
    vi.spyOn(LogsQueryClient.prototype, 'queryWorkspace').mockResolvedValue(
      mockQueryResult([
        ['2026-01-05T00:00:00.000Z', 'msg-1', 'ch-oversight@example.test', 'Bounced'],
        ['2026-01-06T00:00:00.000Z', 'msg-2', 'zoom-341@example.test', 'Failed'],
      ]),
    );
    vi.spyOn(BounceReconstructionUseCase.prototype, 'reconstructAndForward')
      .mockRejectedValueOnce(new Error('archive lookup failed'))
      .mockResolvedValueOnce(undefined);
    vi.spyOn(MockMongoRepository.prototype, 'upsert').mockResolvedValue(expect.anything());
    const errorSpy = vi.spyOn(context.logger, 'error');

    const summary = await useCase.pollAndReconstruct(context);

    expect(summary).toEqual({ found: 2, reconstructed: 1, failed: 1 });
    expect(errorSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('msg-1'),
      expect.any(Error),
    );
  });

  test('uses the existing sync state as the query lower bound when one exists', async () => {
    const existingState: AcsBouncePollState = {
      id: 'ACS_BOUNCE_POLL_STATE',
      documentType: 'ACS_BOUNCE_POLL_STATE',
      lastProcessedTimeGenerated: '2026-02-01T00:00:00.000Z',
    };
    vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(existingState);
    const queryWorkspaceSpy = vi
      .spyOn(LogsQueryClient.prototype, 'queryWorkspace')
      .mockResolvedValue(mockQueryResult([]));
    vi.spyOn(MockMongoRepository.prototype, 'upsert').mockResolvedValue(expect.anything());

    await useCase.pollAndReconstruct(context);

    expect(queryWorkspaceSpy).toHaveBeenCalledWith(
      'workspace-guid',
      expect.any(String),
      expect.objectContaining({ startTime: new Date('2026-02-01T00:00:00.000Z') }),
    );
  });

  test('excludes rows at or before the cursor boundary from being reprocessed', async () => {
    const existingState: AcsBouncePollState = {
      id: 'ACS_BOUNCE_POLL_STATE',
      documentType: 'ACS_BOUNCE_POLL_STATE',
      lastProcessedTimeGenerated: '2026-01-06T00:00:00.000Z',
    };
    vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(existingState);
    vi.spyOn(LogsQueryClient.prototype, 'queryWorkspace').mockResolvedValue(
      mockQueryResult([
        ['2026-01-06T00:00:00.000Z', 'msg-already-processed', 'x@example.test', 'Bounced'],
        ['2026-01-07T00:00:00.000Z', 'msg-new', 'y@example.test', 'Bounced'],
      ]),
    );
    const reconstructSpy = vi
      .spyOn(BounceReconstructionUseCase.prototype, 'reconstructAndForward')
      .mockResolvedValue(undefined);
    vi.spyOn(MockMongoRepository.prototype, 'upsert').mockResolvedValue(expect.anything());

    const summary = await useCase.pollAndReconstruct(context);

    expect(summary.found).toBe(1);
    expect(reconstructSpy).toHaveBeenCalledTimes(1);
    expect(reconstructSpy).toHaveBeenCalledWith(context, 'msg-new', 'admin@example.test');
  });

  test('throws ServerConfigError when the query does not succeed', async () => {
    vi.spyOn(MockMongoRepository.prototype, 'read').mockRejectedValue(
      new NotFoundError(MODULE_NAME, { message: 'No matching item found.' }),
    );
    vi.spyOn(LogsQueryClient.prototype, 'queryWorkspace').mockResolvedValue({
      status: LogsQueryResultStatus.Failure,
      code: 'InternalServerError',
      message: 'boom',
    } as never);

    await expect(useCase.pollAndReconstruct(context)).rejects.toThrow(
      expect.objectContaining({ status: 500 }),
    );
  });
});
