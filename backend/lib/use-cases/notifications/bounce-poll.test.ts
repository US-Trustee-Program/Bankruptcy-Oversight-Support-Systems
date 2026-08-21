import { vi } from 'vitest';
import { ApplicationContext } from '../../adapters/types/basic';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { BouncePollUseCase } from './bounce-poll';
import { BounceReconstructionUseCase } from './bounce-reconstruction';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import { AcsBouncePollState, BounceLogRow, EmailBounceQueryGateway } from '../gateways.types';
import { NotFoundError } from '../../common-errors/not-found-error';

const MODULE_NAME = 'RUNTIME-STATE-MONGO-REPOSITORY';
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function buildGateway(rows: BounceLogRow[] = []): EmailBounceQueryGateway {
  return { queryBounces: vi.fn().mockResolvedValue(rows) };
}

function buildReconstructionUseCase(): BounceReconstructionUseCase {
  return {
    reconstructAndForward: vi.fn().mockResolvedValue(undefined),
  } as unknown as BounceReconstructionUseCase;
}

describe('BouncePollUseCase', () => {
  let context: ApplicationContext;

  beforeEach(async () => {
    vi.restoreAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-01T00:00:00.000Z'));
    context = await createMockApplicationContext({
      env: {
        ANALYTICS_WORKSPACE_CUSTOMER_ID: 'workspace-guid',
        ADMIN_NOTIFICATION_EMAIL: 'admin@example.test',
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('throws ServerConfigError when required env vars are missing', async () => {
    delete process.env.ANALYTICS_WORKSPACE_CUSTOMER_ID;
    const useCase = new BouncePollUseCase(context, buildReconstructionUseCase(), buildGateway());

    await expect(useCase.pollAndReconstruct(context)).rejects.toThrow(
      expect.objectContaining({ status: 500 }),
    );
  });

  test('propagates non-not-found errors from reading poll state instead of resetting the cursor', async () => {
    const connectivityError = new Error('connection refused');
    vi.spyOn(MockMongoRepository.prototype, 'read').mockRejectedValue(connectivityError);
    const gateway = buildGateway();
    const useCase = new BouncePollUseCase(context, buildReconstructionUseCase(), gateway);

    await expect(useCase.pollAndReconstruct(context)).rejects.toThrow(connectivityError);
    expect(gateway.queryBounces).not.toHaveBeenCalled();
  });

  test('returns zero counts and does not upsert state when no rows are found', async () => {
    vi.spyOn(MockMongoRepository.prototype, 'read').mockRejectedValue(
      new NotFoundError(MODULE_NAME, { message: 'No matching item found.' }),
    );
    const upsertSpy = vi.spyOn(MockMongoRepository.prototype, 'upsert');
    const useCase = new BouncePollUseCase(context, buildReconstructionUseCase(), buildGateway([]));

    const summary = await useCase.pollAndReconstruct(context);

    expect(summary).toEqual({ found: 0, reconstructed: 0, failed: 0, expired: 0 });
    expect(upsertSpy).not.toHaveBeenCalled();
  });

  test('reconstructs each bounce row found and advances the cursor to the latest timeGenerated', async () => {
    vi.spyOn(MockMongoRepository.prototype, 'read').mockRejectedValue(
      new NotFoundError(MODULE_NAME, { message: 'No matching item found.' }),
    );
    const upsertSpy = vi
      .spyOn(MockMongoRepository.prototype, 'upsert')
      .mockResolvedValue(expect.anything());
    const reconstructionUseCase = buildReconstructionUseCase();
    const rows: BounceLogRow[] = [
      { timeGenerated: '2026-01-05T00:00:00.000Z', messageId: 'msg-1' },
      { timeGenerated: '2026-01-06T00:00:00.000Z', messageId: 'msg-2' },
    ];
    const useCase = new BouncePollUseCase(context, reconstructionUseCase, buildGateway(rows));

    const summary = await useCase.pollAndReconstruct(context);

    expect(summary).toEqual({ found: 2, reconstructed: 2, failed: 0, expired: 0 });
    expect(reconstructionUseCase.reconstructAndForward).toHaveBeenCalledWith(
      context,
      'msg-1',
      'admin@example.test',
    );
    expect(reconstructionUseCase.reconstructAndForward).toHaveBeenCalledWith(
      context,
      'msg-2',
      'admin@example.test',
    );
    expect(upsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        documentType: 'ACS_BOUNCE_POLL_STATE',
        lastProcessedTimeGenerated: '2026-01-06T00:00:00.000Z',
      }),
    );
  });

  test('stops advancing the cursor at the first non-expired failure, leaving later rows for retry', async () => {
    vi.spyOn(MockMongoRepository.prototype, 'read').mockRejectedValue(
      new NotFoundError(MODULE_NAME, { message: 'No matching item found.' }),
    );
    const upsertSpy = vi
      .spyOn(MockMongoRepository.prototype, 'upsert')
      .mockResolvedValue(expect.anything());
    const reconstructionUseCase = buildReconstructionUseCase();
    vi.mocked(reconstructionUseCase.reconstructAndForward)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('transient ACS send failure'))
      .mockResolvedValueOnce(undefined);
    const rows: BounceLogRow[] = [
      { timeGenerated: '2026-01-05T00:00:00.000Z', messageId: 'msg-ok' },
      { timeGenerated: '2026-01-06T00:00:00.000Z', messageId: 'msg-transient-failure' },
      { timeGenerated: '2026-01-07T00:00:00.000Z', messageId: 'msg-never-attempted' },
    ];
    const errorSpy = vi.spyOn(context.logger, 'error');
    const useCase = new BouncePollUseCase(context, reconstructionUseCase, buildGateway(rows));

    const summary = await useCase.pollAndReconstruct(context);

    expect(summary).toEqual({ found: 3, reconstructed: 1, failed: 1, expired: 0 });
    expect(reconstructionUseCase.reconstructAndForward).toHaveBeenCalledTimes(2);
    expect(reconstructionUseCase.reconstructAndForward).not.toHaveBeenCalledWith(
      context,
      'msg-never-attempted',
      'admin@example.test',
    );
    expect(upsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({ lastProcessedTimeGenerated: '2026-01-05T00:00:00.000Z' }),
    );
    expect(errorSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('msg-transient-failure'),
      expect.any(Error),
    );
  });

  test('skips permanently past a row whose archive has expired, without treating it as a blocking failure', async () => {
    vi.spyOn(MockMongoRepository.prototype, 'read').mockRejectedValue(
      new NotFoundError(MODULE_NAME, { message: 'No matching item found.' }),
    );
    const upsertSpy = vi
      .spyOn(MockMongoRepository.prototype, 'upsert')
      .mockResolvedValue(expect.anything());
    const reconstructionUseCase = buildReconstructionUseCase();
    vi.mocked(reconstructionUseCase.reconstructAndForward)
      .mockRejectedValueOnce(
        new NotFoundError('BOUNCE-RECONSTRUCTION', { message: 'No archived email found.' }),
      )
      .mockResolvedValueOnce(undefined);
    const rows: BounceLogRow[] = [
      { timeGenerated: '2026-01-05T00:00:00.000Z', messageId: 'msg-expired' },
      { timeGenerated: '2026-01-06T00:00:00.000Z', messageId: 'msg-ok' },
    ];
    const useCase = new BouncePollUseCase(context, reconstructionUseCase, buildGateway(rows));

    const summary = await useCase.pollAndReconstruct(context);

    expect(summary).toEqual({ found: 2, reconstructed: 1, failed: 0, expired: 1 });
    expect(reconstructionUseCase.reconstructAndForward).toHaveBeenCalledTimes(2);
    expect(upsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({ lastProcessedTimeGenerated: '2026-01-06T00:00:00.000Z' }),
    );
  });

  test('uses the existing sync state as the query lower bound when it is within the lookback window', async () => {
    const existingState: AcsBouncePollState = {
      id: 'ACS_BOUNCE_POLL_STATE',
      documentType: 'ACS_BOUNCE_POLL_STATE',
      lastProcessedTimeGenerated: '2026-01-30T00:00:00.000Z',
    };
    vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(existingState);
    vi.spyOn(MockMongoRepository.prototype, 'upsert').mockResolvedValue(expect.anything());
    const gateway = buildGateway([]);
    const useCase = new BouncePollUseCase(context, buildReconstructionUseCase(), gateway);

    await useCase.pollAndReconstruct(context);

    expect(gateway.queryBounces).toHaveBeenCalledWith('workspace-guid', '2026-01-30T00:00:00.000Z');
  });

  test('bounds the lookback to the archive TTL when no poll state exists yet', async () => {
    vi.spyOn(MockMongoRepository.prototype, 'read').mockRejectedValue(
      new NotFoundError(MODULE_NAME, { message: 'No matching item found.' }),
    );
    const gateway = buildGateway([]);
    const useCase = new BouncePollUseCase(context, buildReconstructionUseCase(), gateway);

    await useCase.pollAndReconstruct(context);

    const expectedSince = new Date(Date.now() - SEVEN_DAYS_MS).toISOString();
    expect(gateway.queryBounces).toHaveBeenCalledWith('workspace-guid', expectedSince);
  });

  test('bounds the lookback to the archive TTL when the persisted cursor is older than that', async () => {
    const existingState: AcsBouncePollState = {
      id: 'ACS_BOUNCE_POLL_STATE',
      documentType: 'ACS_BOUNCE_POLL_STATE',
      lastProcessedTimeGenerated: '2020-01-01T00:00:00.000Z',
    };
    vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(existingState);
    vi.spyOn(MockMongoRepository.prototype, 'upsert').mockResolvedValue(expect.anything());
    const gateway = buildGateway([]);
    const useCase = new BouncePollUseCase(context, buildReconstructionUseCase(), gateway);

    await useCase.pollAndReconstruct(context);

    const expectedSince = new Date(Date.now() - SEVEN_DAYS_MS).toISOString();
    expect(gateway.queryBounces).toHaveBeenCalledWith('workspace-guid', expectedSince);
  });

  test('propagates errors from the bounce query gateway', async () => {
    vi.spyOn(MockMongoRepository.prototype, 'read').mockRejectedValue(
      new NotFoundError(MODULE_NAME, { message: 'No matching item found.' }),
    );
    const gateway: EmailBounceQueryGateway = {
      queryBounces: vi.fn().mockRejectedValue(new Error('query failed')),
    };
    const useCase = new BouncePollUseCase(context, buildReconstructionUseCase(), gateway);

    await expect(useCase.pollAndReconstruct(context)).rejects.toThrow('query failed');
  });
});
