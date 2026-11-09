import { describe, test, expect, vi, beforeEach } from 'vitest';
import { InvocationContext } from '@azure/functions';
import * as DataflowTelemetry from '../../lib/use-cases/dataflows/dataflow-telemetry';
import { TooManyRequestsError } from '../../lib/common-errors/too-many-requests-error';
import { StorageQueueHumbleObject } from '../../lib/humble-objects/storage-queue-humble';
import ApplicationContextCreator from '../azure/application-context-creator';
import { createMockApplicationContext } from '../../lib/testing/testing-utilities';
import { ApplicationContext } from '../../lib/adapters/types/basic';
import HealSentinelCaseAppointmentsUseCase from '../../lib/use-cases/dataflows/heal-sentinel-case-appointments';
import { handleHeal } from './heal-sentinel-case-appointments';

const makeInvocationContext = (): InvocationContext =>
  ({
    invocationId: 'test-id',
    functionName: 'heal-sentinel-case-appointments',
    extraOutputs: new Map(),
    log: vi.fn(),
  }) as unknown as InvocationContext;

type HealPageResult = Awaited<ReturnType<HealSentinelCaseAppointmentsUseCase['healPage']>>;

const pageResult = (overrides: Partial<HealPageResult> = {}): HealPageResult => ({
  documentsWritten: 1,
  documentsFailed: 0,
  pageSize: 1,
  nextLastId: 'mongo-next',
  ...overrides,
});

// handleHeal owns only the queue mechanics (cursor continuation, rate-limit retry, telemetry); the
// healing rules are tested in lib/use-cases/dataflows/heal-sentinel-case-appointments.test.ts, so
// healPage is stubbed here.
describe('heal-sentinel-case-appointments handleHeal', () => {
  let mockContext: ApplicationContext;
  let healPageSpy: ReturnType<typeof vi.spyOn>;
  let mockSendMessage: ReturnType<typeof vi.fn>;
  let fromConnectionStringSpy: ReturnType<typeof vi.spyOn>;
  let telemetrySpy: ReturnType<typeof vi.spyOn>;

  const traceWith = (result: Record<string, unknown>) =>
    expect(telemetrySpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'HEAL-SENTINEL-CASE-APPOINTMENTS',
      'handleHeal',
      expect.anything(),
      expect.objectContaining(result),
    );

  beforeEach(async () => {
    vi.restoreAllMocks();
    process.env.AzureWebJobsDataflowsStorage = 'DefaultEndpointsProtocol=https://test';
    mockContext = await createMockApplicationContext();
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);
    healPageSpy = vi
      .spyOn(HealSentinelCaseAppointmentsUseCase.prototype, 'healPage')
      .mockResolvedValue(pageResult());
    mockSendMessage = vi.fn().mockResolvedValue(undefined);
    fromConnectionStringSpy = vi
      .spyOn(StorageQueueHumbleObject, 'fromConnectionString')
      .mockReturnValue({ sendMessage: mockSendMessage } as unknown as StorageQueueHumbleObject);
    telemetrySpy = vi.spyOn(DataflowTelemetry, 'completeDataflowTrace');
  });

  test.each([
    ['the first page (no lastId)', {}, null],
    ['a continuation page', { lastId: 'mongo-prev' }, 'mongo-prev'],
  ])('passes the cursor and page size of 25 to healPage on %s', async (_label, message, cursor) => {
    await handleHeal(message, makeInvocationContext());

    expect(healPageSpy).toHaveBeenCalledWith(cursor, 25);
  });

  test('a non-empty page requeues a continuation on the heal queue carrying only lastId', async () => {
    // handleRateLimitRetry sets retryCount/firstAttemptAt on a requeued message; carrying them
    // into continuations would shorten the retry budget of every later page.
    await handleHeal(
      { lastId: 'mongo-prev', retryCount: 2, firstAttemptAt: '2026-11-09T00:00:00.000Z' },
      makeInvocationContext(),
    );

    expect(fromConnectionStringSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining('heal-sentinel-case-appointments'),
    );
    expect(mockSendMessage).toHaveBeenCalledWith(JSON.stringify({ lastId: 'mongo-next' }));
    traceWith({ success: true, documentsWritten: 1, documentsFailed: 0 });
  });

  test('an empty page ends the run with no continuation', async () => {
    healPageSpy.mockResolvedValue(
      pageResult({ documentsWritten: 0, pageSize: 0, nextLastId: null }),
    );

    await handleHeal({}, makeInvocationContext());

    expect(mockSendMessage).not.toHaveBeenCalled();
    traceWith({ success: true, documentsWritten: 0, documentsFailed: 0 });
  });

  test('a 429 requeues the page with an incremented retryCount and a rate-limited trace', async () => {
    healPageSpy.mockRejectedValue(new TooManyRequestsError('HEAL-SENTINEL-CASE-APPOINTMENTS'));

    await handleHeal({ retryCount: 0 }, makeInvocationContext());

    expect(JSON.parse(mockSendMessage.mock.calls[0][0])).toEqual(
      expect.objectContaining({ retryCount: 1 }),
    );
    traceWith({ success: false, error: 'rate-limited-requeued' });
  });

  test('routes to the DLQ when the retry limit is exhausted', async () => {
    healPageSpy.mockRejectedValue(new TooManyRequestsError('HEAL-SENTINEL-CASE-APPOINTMENTS'));
    const extraOutputsSetSpy = vi.spyOn(mockContext.extraOutputs, 'set');

    await handleHeal({ retryCount: 10 }, makeInvocationContext());

    expect(extraOutputsSetSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queueName: expect.stringContaining('dlq') }),
      expect.anything(),
    );
    traceWith({ success: false, documentsFailed: 1, error: 'rate-limit-retry-exhausted' });
  });

  test('rethrows non-rate-limit errors', async () => {
    healPageSpy.mockRejectedValue(new Error('boom'));

    await expect(handleHeal({}, makeInvocationContext())).rejects.toThrow('boom');
  });

  test('throws when AzureWebJobsDataflowsStorage is not configured', async () => {
    delete process.env.AzureWebJobsDataflowsStorage;

    await expect(handleHeal({}, makeInvocationContext())).rejects.toThrow(
      'Missing required environment variable: AzureWebJobsDataflowsStorage',
    );
  });
});
