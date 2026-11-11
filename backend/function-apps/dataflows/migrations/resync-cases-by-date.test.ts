import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { InvocationContext } from '@azure/functions';
import * as ExportAndLoadCaseModule from '../../../lib/use-cases/dataflows/export-and-load-case';
import * as SyncCasesModule from '../../../lib/use-cases/dataflows/sync-cases';
import { TooManyRequestsError } from '../../../lib/common-errors/too-many-requests-error';
import { GatewayTimeoutError } from '../../../lib/common-errors/gateway-timeout';
import { NotFoundError } from '../../../lib/common-errors/not-found-error';
import { CamsError } from '../../../lib/common-errors/cams-error';
import { StorageQueueHumbleObject } from '../../../lib/humble-objects/storage-queue-humble';
import ApplicationContextCreator from '../../azure/application-context-creator';
import { createMockApplicationContext } from '../../../lib/testing/testing-utilities';
import { CaseSyncEvent } from '@common/cams/dataflow-events';
import { RATE_LIMIT_RETRY_LIMIT } from '../dataflows-rate-limit';
import { buildQueueError } from '../../../lib/use-cases/dataflows/queue-types';
import { FIX_QUEUE_NAME } from './division-change-cleanup';
import { DEFAULT_INVOCATION_BUDGET_MS } from '../../../lib/use-cases/dataflows/invocation-budget';
import type * as ResyncModule from './resync-cases-by-date';
const makeInvocationContext = (): InvocationContext =>
  ({
    invocationId: 'test-id',
    functionName: 'resync-cases-by-date',
    extraOutputs: new Map(),
    log: vi.fn(),
  }) as unknown as InvocationContext;

type PageMessage = { events: CaseSyncEvent[]; retryCount?: number; firstAttemptAt?: string };

const PAGE_QUEUE = 'resync-cases-by-date-page';
const WRITER_QUEUE = 'resync-cases-by-date-writer';
const DLQ_QUEUE = 'resync-cases-by-date-dlq';
const LANE_COUNT_ENV = 'RESYNC_CASES_BY_DATE_LANE_COUNT';

type SentMessage = { text: string; visibilityTimeout?: number; messageTimeToLive?: number };
type StoredMessage = {
  messageId: string;
  popReceipt: string;
  messageText: string;
  leased: boolean;
};

/**
 * In-memory stand-in for one storage queue. Records every send and delete in a log shared with
 * the other queues so tests can assert that follow-up messages are sent before a page is deleted.
 */
class FakeQueue {
  readonly sent: SentMessage[] = [];
  private readonly stored: StoredMessage[] = [];
  private sequence = 0;

  constructor(
    readonly name: string,
    private readonly log: string[],
  ) {}

  get remaining(): string[] {
    return this.stored.map((message) => message.messageText);
  }

  seed(messageText: string, { leased = false }: { leased?: boolean } = {}) {
    this.stored.push({
      messageId: `${this.name}-${++this.sequence}`,
      popReceipt: 'receipt',
      messageText,
      leased,
    });
  }

  async sendMessage(text: string, visibilityTimeout?: number, messageTimeToLive?: number) {
    this.sent.push({ text, visibilityTimeout, messageTimeToLive });
    this.log.push(`send:${this.name}`);
    this.seed(text);
  }

  async receiveMessage(_visibilityTimeout: number) {
    const message = this.stored.find((candidate) => !candidate.leased);
    if (!message) return undefined;
    message.leased = true;
    return {
      messageId: message.messageId,
      popReceipt: message.popReceipt,
      messageText: message.messageText,
    };
  }

  async deleteMessage(messageId: string, _popReceipt: string): Promise<boolean> {
    this.log.push(`delete:${this.name}`);
    const index = this.stored.findIndex((message) => message.messageId === messageId);
    if (index === -1) return false;
    this.stored.splice(index, 1);
    return true;
  }

  async getApproximateMessageCount() {
    return this.stored.length;
  }
}

class FakeQueues {
  readonly log: string[] = [];
  private readonly queues = new Map<string, FakeQueue>();

  get(name: string): FakeQueue {
    let queue = this.queues.get(name);
    if (!queue) {
      queue = new FakeQueue(name, this.log);
      this.queues.set(name, queue);
    }
    return queue;
  }
}

function stubQueues(): FakeQueues {
  const queues = new FakeQueues();
  vi.spyOn(StorageQueueHumbleObject, 'fromConnectionString').mockImplementation(
    (_connectionString, queueName) => queues.get(queueName) as unknown as StorageQueueHumbleObject,
  );
  return queues;
}

function setLaneCount(value: string | undefined) {
  if (value === undefined) {
    delete process.env[LANE_COUNT_ENV];
  } else {
    process.env[LANE_COUNT_ENV] = value;
  }
}

function outputFor(invocationContext: InvocationContext, queueName: string): unknown {
  const entry = Array.from(
    (invocationContext.extraOutputs as unknown as Map<{ queueName: string }, unknown>).entries(),
  ).find(([key]) => key.queueName === queueName);
  return entry?.[1];
}

beforeEach(() => {
  process.env.AzureWebJobsDataflowsStorage = 'DefaultEndpointsProtocol=https://test';
});

describe('resync-cases-by-date handler configuration', () => {
  test.each([
    {
      handler: 'handleStart',
      invoke: (module: typeof ResyncModule, context: InvocationContext) =>
        module.handleStart({ fromDate: '2024-01-01' }, context),
    },
    {
      handler: 'handleWriter',
      invoke: (module: typeof ResyncModule, context: InvocationContext) =>
        module.handleWriter({ runId: 'run-1', laneId: 0 }, context),
    },
    {
      handler: 'handleRetry',
      invoke: (module: typeof ResyncModule, context: InvocationContext) =>
        module.handleRetry({ type: 'CASE_CHANGED', caseId: '001-25-00001' }, context),
    },
  ])('$handler rejects when AzureWebJobsDataflowsStorage is not set', async ({ invoke }) => {
    delete process.env.AzureWebJobsDataflowsStorage;
    const module = await import('./resync-cases-by-date');

    await expect(invoke(module, makeInvocationContext())).rejects.toThrow(
      'Missing required environment variable: AzureWebJobsDataflowsStorage',
    );
  });
});

describe('resync-cases-by-date handleStart', () => {
  afterEach(() => {
    setLaneCount(undefined);
  });

  test.each([
    { laneCount: '3', expectedLanes: 3 },
    { laneCount: undefined, expectedLanes: 40 },
    { laneCount: '0', expectedLanes: 40 },
    { laneCount: 'abc', expectedLanes: 40 },
    { laneCount: '2.5', expectedLanes: 40 },
  ])(
    'sends each page to the PAGE queue with no expiry and emits $expectedLanes lane writers',
    async ({ laneCount, expectedLanes }) => {
      const { handleStart } = await import('./resync-cases-by-date');
      const events: CaseSyncEvent[] = [{ type: 'CASE_CHANGED', caseId: '001-25-00001' }];
      const invocationContext = makeInvocationContext();
      setLaneCount(laneCount);

      vi.spyOn(SyncCasesModule.default, 'getCaseIds').mockResolvedValue({
        events,
        lastCasesSyncDate: '2024-01-01',
        lastTransactionsSyncDate: '2024-01-01',
      });
      vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
        await createMockApplicationContext(),
      );
      const queues = stubQueues();

      await handleStart({ fromDate: '2024-01-01' }, invocationContext);

      const [page] = queues.get(PAGE_QUEUE).sent;
      expect(JSON.parse(page.text)).toEqual({ events });
      expect(page.messageTimeToLive).toBe(-1);
      expect(outputFor(invocationContext, WRITER_QUEUE)).toEqual(
        Array.from({ length: expectedLanes }, (_, laneId) => ({ runId: 'test-id', laneId })),
      );
    },
  );

  test('does nothing when fromDate is missing', async () => {
    const { handleStart } = await import('./resync-cases-by-date');
    const invocationContext = makeInvocationContext();
    const getCaseIdsSpy = vi.spyOn(SyncCasesModule.default, 'getCaseIds');
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );

    await handleStart({ fromDate: '' }, invocationContext);

    expect(getCaseIdsSpy).not.toHaveBeenCalled();
    expect((invocationContext.extraOutputs as unknown as Map<unknown, unknown>).size).toBe(0);
  });

  test('does nothing when no cases are found', async () => {
    const { handleStart } = await import('./resync-cases-by-date');
    const invocationContext = makeInvocationContext();

    vi.spyOn(SyncCasesModule.default, 'getCaseIds').mockResolvedValue({
      events: [],
      lastCasesSyncDate: '2024-01-01',
      lastTransactionsSyncDate: '2024-01-01',
    });
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );

    await handleStart({ fromDate: '2024-01-01' }, invocationContext);

    expect((invocationContext.extraOutputs as unknown as Map<unknown, unknown>).size).toBe(0);
  });

  test.each([
    { label: 'TooManyRequestsError', build: () => new TooManyRequestsError('TEST') },
    { label: 'GatewayTimeoutError', build: () => new GatewayTimeoutError('TEST') },
  ])(
    'requeues the start message with backoff instead of throwing when getCaseIds fails with a $label',
    async ({ build }) => {
      const { handleStart } = await import('./resync-cases-by-date');
      const invocationContext = makeInvocationContext();

      vi.spyOn(SyncCasesModule.default, 'getCaseIds').mockRejectedValue(build());
      const mockContext = await createMockApplicationContext();
      mockContext.extraOutputs = invocationContext.extraOutputs;
      vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);
      const mockSendMessage = vi.fn().mockResolvedValue(undefined);
      const fromConnectionStringSpy = vi
        .spyOn(StorageQueueHumbleObject, 'fromConnectionString')
        .mockReturnValue({ sendMessage: mockSendMessage } as unknown as StorageQueueHumbleObject);

      await expect(
        handleStart({ fromDate: '2024-01-01' }, invocationContext),
      ).resolves.toBeUndefined();

      expect(fromConnectionStringSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('start'),
      );
      expect(mockSendMessage).toHaveBeenCalledWith(expect.any(String), expect.any(Number));
      const [body, visibilityTimeout] = mockSendMessage.mock.calls[0];
      expect(JSON.parse(body)).toEqual({
        fromDate: '2024-01-01',
        retryCount: 1,
        firstAttemptAt: expect.any(String),
      });
      expect(visibilityTimeout).toBeGreaterThan(0);
    },
  );

  test('routes the start message to DLQ instead of throwing when the transient-error retry limit is exhausted', async () => {
    const { handleStart } = await import('./resync-cases-by-date');
    const invocationContext = makeInvocationContext();

    vi.spyOn(SyncCasesModule.default, 'getCaseIds').mockRejectedValue(
      new TooManyRequestsError('TEST'),
    );
    const mockContext = await createMockApplicationContext();
    mockContext.extraOutputs = invocationContext.extraOutputs;
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);
    const fromConnectionStringSpy = vi.spyOn(StorageQueueHumbleObject, 'fromConnectionString');

    await expect(
      handleStart(
        { fromDate: '2024-01-01', retryCount: RATE_LIMIT_RETRY_LIMIT },
        invocationContext,
      ),
    ).resolves.toBeUndefined();

    expect(fromConnectionStringSpy).not.toHaveBeenCalled();
    const outputs = Array.from(
      (invocationContext.extraOutputs as unknown as Map<{ queueName: string }, unknown>).entries(),
    );
    const dlqOutput = outputs.find(([key]) => key.queueName?.includes('dlq'));
    expect(dlqOutput?.[1]).toEqual([
      expect.objectContaining({ type: 'QUEUE_ERROR', retryCount: RATE_LIMIT_RETRY_LIMIT }),
    ]);
  });

  test('rethrows a non-transient getCaseIds failure without routing it to DLQ', async () => {
    const { handleStart } = await import('./resync-cases-by-date');
    const invocationContext = makeInvocationContext();

    vi.spyOn(SyncCasesModule.default, 'getCaseIds').mockRejectedValue(
      new Error('Database connection failed'),
    );
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );

    await expect(handleStart({ fromDate: '2024-01-01' }, invocationContext)).rejects.toThrow(
      'Database connection failed',
    );
    expect((invocationContext.extraOutputs as unknown as Map<unknown, unknown>).size).toBe(0);
  });
});

describe('resync-cases-by-date handleError', () => {
  test('routes a QueueError to HARD_STOP keeping its root cause and does not queue it for retry', async () => {
    const { handleError } = await import('./resync-cases-by-date');
    const queueError = buildQueueError(
      new CamsError('TEST', { message: 'root cause' }),
      'RESYNC-CASES-BY-DATE',
      'handlePage',
    );
    const invocationContext = makeInvocationContext();
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );

    await handleError(queueError, invocationContext);

    const outputs = Array.from(
      (invocationContext.extraOutputs as unknown as Map<{ queueName: string }, unknown>).entries(),
    );
    const hardStopOutput = outputs.find(([key]) => key.queueName?.includes('hard-stop'));
    expect(hardStopOutput?.[1]).toEqual([
      expect.objectContaining({
        type: 'QUEUE_ERROR',
        error: expect.objectContaining({ message: 'root cause' }),
      }),
    ]);
    const retryOutput = outputs.find(([key]) => key.queueName?.includes('retry'));
    expect(retryOutput).toBeUndefined();
  });

  test('abandons the event without queueing a retry when the error is a NotFoundError', async () => {
    const { handleError } = await import('./resync-cases-by-date');
    const event: CaseSyncEvent = {
      type: 'CASE_CHANGED',
      caseId: '001-25-00001',
      error: new NotFoundError('TEST'),
    };
    const invocationContext = makeInvocationContext();
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );

    await handleError(event, invocationContext);

    expect((invocationContext.extraOutputs as unknown as Map<unknown, unknown>).size).toBe(0);
  });

  test('clears the error and queues the event for retry when the error is not a NotFoundError', async () => {
    const { handleError } = await import('./resync-cases-by-date');
    const event: CaseSyncEvent = {
      type: 'CASE_CHANGED',
      caseId: '001-25-00001',
      error: new CamsError('TEST', { message: 'transient failure' }),
    };
    const invocationContext = makeInvocationContext();
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );

    await handleError(event, invocationContext);

    const outputs = Array.from(
      (invocationContext.extraOutputs as unknown as Map<{ queueName: string }, unknown>).entries(),
    );
    const retryOutput = outputs.find(([key]) => key.queueName?.includes('retry'));
    expect(retryOutput).toBeDefined();
    const [retryEvent] = retryOutput?.[1] as CaseSyncEvent[];
    expect(retryEvent.error).toBeUndefined();
  });
});

describe('resync-cases-by-date handleRetry', () => {
  test.each([
    { label: 'TooManyRequestsError', build: () => new TooManyRequestsError('TEST') },
    { label: 'GatewayTimeoutError', build: () => new GatewayTimeoutError('TEST') },
  ])(
    'requeues a $label with backoff instead of routing to DLQ, preserving the manual retryCount',
    async ({ build }) => {
      const { handleRetry } = await import('./resync-cases-by-date');
      const event: CaseSyncEvent = { type: 'CASE_CHANGED', caseId: '001-25-00001' };
      const invocationContext = makeInvocationContext();

      vi.spyOn(ExportAndLoadCaseModule.default, 'exportAndLoad').mockRejectedValue(build());
      vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
        await createMockApplicationContext(),
      );

      const mockSendMessage = vi.fn().mockResolvedValue(undefined);
      const fromConnectionStringSpy = vi
        .spyOn(StorageQueueHumbleObject, 'fromConnectionString')
        .mockReturnValue({ sendMessage: mockSendMessage } as unknown as StorageQueueHumbleObject);

      await handleRetry(event, invocationContext);

      const outputs = Array.from(
        (
          invocationContext.extraOutputs as unknown as Map<{ queueName: string }, unknown>
        ).entries(),
      );
      const dlqOutput = outputs.find(([key]) => key.queueName?.includes('dlq'));
      expect(dlqOutput).toBeUndefined();

      expect(fromConnectionStringSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('retry'),
      );
      expect(mockSendMessage).toHaveBeenCalledTimes(1);
      const [body, visibilityTimeout] = mockSendMessage.mock.calls[0];
      const retryEvent = JSON.parse(body) as CaseSyncEvent;
      expect(retryEvent.error).toBeUndefined();
      expect(retryEvent.retryCount).toBe(1);
      expect(visibilityTimeout).toBeGreaterThan(0);
    },
  );

  test('routes the event to DLQ when exportAndLoad resolves with a captured (non-transient) event.error, without throwing', async () => {
    const { handleRetry } = await import('./resync-cases-by-date');
    const event: CaseSyncEvent = { type: 'CASE_CHANGED', caseId: '001-25-00001' };
    const invocationContext = makeInvocationContext();
    const camsError = new CamsError('TEST', { message: 'case sync failed' });

    vi.spyOn(ExportAndLoadCaseModule.default, 'exportAndLoad').mockResolvedValue([
      { ...event, error: camsError },
    ]);
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );

    await handleRetry(event, invocationContext);

    const outputs = Array.from(
      (invocationContext.extraOutputs as unknown as Map<{ queueName: string }, unknown>).entries(),
    );
    const dlqOutput = outputs.find(([key]) => key.queueName?.includes('dlq'));
    expect(dlqOutput).toBeDefined();
    const [dlqEvent] = dlqOutput?.[1] as CaseSyncEvent[];
    expect(dlqEvent.error).toBe(camsError);
  });

  test('routes to HARD_STOP without calling exportAndLoad once the retry limit is exceeded', async () => {
    const { handleRetry } = await import('./resync-cases-by-date');
    const event: CaseSyncEvent = { type: 'CASE_CHANGED', caseId: '001-25-00001', retryCount: 3 };
    const invocationContext = makeInvocationContext();
    const exportAndLoadSpy = vi.spyOn(ExportAndLoadCaseModule.default, 'exportAndLoad');
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );

    await handleRetry(event, invocationContext);

    expect(exportAndLoadSpy).not.toHaveBeenCalled();
    const outputs = Array.from(
      (invocationContext.extraOutputs as unknown as Map<{ queueName: string }, unknown>).entries(),
    );
    const hardStopOutput = outputs.find(([key]) => key.queueName?.includes('hard-stop'));
    expect(hardStopOutput).toBeDefined();
    const [hardStopEvent] = hardStopOutput?.[1] as CaseSyncEvent[];
    expect(hardStopEvent.retryCount).toBe(4);
  });

  test('routes a retry result carrying both an error and a division change to DLQ, not FIX', async () => {
    const { handleRetry } = await import('./resync-cases-by-date');
    const event: CaseSyncEvent = { type: 'CASE_CHANGED', caseId: '001-25-00001' };
    const invocationContext = makeInvocationContext();
    const camsError = new CamsError('TEST', { message: 'case sync failed' });
    const divisionChange = { orphanedCaseId: '081-25-00001', currentCaseId: '001-25-00001' };

    vi.spyOn(ExportAndLoadCaseModule.default, 'exportAndLoad').mockResolvedValue([
      { ...event, error: camsError, divisionChange },
    ]);
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );

    await handleRetry(event, invocationContext);

    expect(outputFor(invocationContext, DLQ_QUEUE)).toEqual([
      expect.objectContaining({ error: camsError }),
    ]);
    expect(outputFor(invocationContext, FIX_QUEUE_NAME)).toBeUndefined();
  });

  test('routes to FIX when the retry detects a division change', async () => {
    const { handleRetry } = await import('./resync-cases-by-date');
    const event: CaseSyncEvent = { type: 'CASE_CHANGED', caseId: '001-25-00001' };
    const invocationContext = makeInvocationContext();
    const divisionChange = { orphanedCaseId: '081-25-00001', currentCaseId: '001-25-00001' };

    vi.spyOn(ExportAndLoadCaseModule.default, 'exportAndLoad').mockResolvedValue([
      { ...event, divisionChange },
    ]);
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );

    await handleRetry(event, invocationContext);

    const outputs = Array.from(
      (invocationContext.extraOutputs as unknown as Map<{ queueName: string }, unknown>).entries(),
    );
    const fixOutput = outputs.find(([key]) => key.queueName?.includes('fix'));
    expect(fixOutput).toBeDefined();
    expect(fixOutput?.[1]).toEqual([divisionChange]);
  });

  test('sets no outputs when the retry succeeds cleanly', async () => {
    const { handleRetry } = await import('./resync-cases-by-date');
    const event: CaseSyncEvent = { type: 'CASE_CHANGED', caseId: '001-25-00001' };
    const invocationContext = makeInvocationContext();

    vi.spyOn(ExportAndLoadCaseModule.default, 'exportAndLoad').mockResolvedValue([{ ...event }]);
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );

    await handleRetry(event, invocationContext);

    expect((invocationContext.extraOutputs as unknown as Map<unknown, unknown>).size).toBe(0);
  });

  test('re-throws a non-transient error', async () => {
    const { handleRetry } = await import('./resync-cases-by-date');
    const event: CaseSyncEvent = { type: 'CASE_CHANGED', caseId: '001-25-00001' };
    const invocationContext = makeInvocationContext();

    vi.spyOn(ExportAndLoadCaseModule.default, 'exportAndLoad').mockRejectedValue(new Error('boom'));
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );

    await expect(handleRetry(event, invocationContext)).rejects.toThrow('boom');
  });
});

describe('resync-cases-by-date handleWriter', () => {
  const TARGET_RU_ENV = 'RESYNC_CASES_BY_DATE_TARGET_RU_PER_SEC';
  const writerMessage = { runId: 'run-1', laneId: 2 };
  const FIRST_ATTEMPT_AT = '2026-11-01T00:00:00.000Z';
  const [CASE_A, CASE_B, CASE_C, CASE_D] = [
    '001-25-00001',
    '001-25-00002',
    '001-25-00003',
    '001-25-00004',
  ];
  const caseEvent = (caseId: string): CaseSyncEvent => ({ type: 'CASE_CHANGED', caseId });
  const divisionChange = { orphanedCaseId: '081-25-00001', currentCaseId: CASE_A };

  beforeEach(() => {
    // A very high target keeps the pacing sleep at zero so these tests do not wait on real time.
    process.env[TARGET_RU_ENV] = '1e15';
  });

  afterEach(() => {
    delete process.env[TARGET_RU_ENV];
    vi.useRealTimers();
  });

  function stubExportAndLoad(handle: (event: CaseSyncEvent) => void = () => undefined) {
    return vi
      .spyOn(ExportAndLoadCaseModule.default, 'exportAndLoad')
      .mockImplementation(async (_context, events) => {
        events.forEach(handle);
        return events;
      });
  }

  function exportedCaseIds(spy: ReturnType<typeof stubExportAndLoad>): string[] {
    return spy.mock.calls.map(([, events]) => events[0].caseId);
  }

  function sentJson(queue: FakeQueue): unknown[] {
    return queue.sent.map(({ text }) => JSON.parse(text));
  }

  function seedPage(queues: FakeQueues, body: PageMessage) {
    queues.get(PAGE_QUEUE).seed(JSON.stringify(body));
  }

  async function givenContext() {
    const context = await createMockApplicationContext();
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(context);
    return context;
  }

  test('syncs each case of a page one at a time, routes results, and deletes the page after the follow-up messages are sent', async () => {
    const { handleWriter } = await import('./resync-cases-by-date');
    const queues = stubQueues();
    await givenContext();
    seedPage(queues, { events: [caseEvent(CASE_A), caseEvent(CASE_B), caseEvent(CASE_C)] });
    const exportSpy = stubExportAndLoad((event) => {
      if (event.caseId === CASE_B) event.error = new CamsError('TEST', { message: 'bad' });
      if (event.caseId === CASE_C) {
        event.divisionChange = { orphanedCaseId: '081-25-00003', currentCaseId: CASE_C };
      }
    });

    await handleWriter(writerMessage, makeInvocationContext());

    expect(exportedCaseIds(exportSpy)).toEqual([CASE_A, CASE_B, CASE_C]);
    expect(exportSpy.mock.calls.map(([, events]) => events.length)).toEqual([1, 1, 1]);
    expect(sentJson(queues.get(FIX_QUEUE_NAME))).toEqual([
      { orphanedCaseId: '081-25-00003', currentCaseId: CASE_C },
    ]);
    expect(sentJson(queues.get(DLQ_QUEUE))).toEqual([
      expect.objectContaining({
        caseId: CASE_B,
        error: expect.objectContaining({ message: 'bad' }),
      }),
    ]);
    expect(queues.get(PAGE_QUEUE).remaining).toEqual([]);
    const pageDeleted = queues.log.indexOf(`delete:${PAGE_QUEUE}`);
    expect(pageDeleted).toBeGreaterThan(queues.log.indexOf(`send:${FIX_QUEUE_NAME}`));
    expect(pageDeleted).toBeGreaterThan(queues.log.indexOf(`send:${DLQ_QUEUE}`));
  });

  test('routes an event carrying both a division change and an error to DLQ, not FIX', async () => {
    const { handleWriter } = await import('./resync-cases-by-date');
    const queues = stubQueues();
    await givenContext();
    seedPage(queues, { events: [caseEvent(CASE_A)] });
    stubExportAndLoad((event) => {
      event.divisionChange = divisionChange;
      event.error = new CamsError('TEST', { message: 'bad' });
    });

    await handleWriter(writerMessage, makeInvocationContext());

    expect(sentJson(queues.get(DLQ_QUEUE))).toEqual([
      expect.objectContaining({
        caseId: CASE_A,
        error: expect.objectContaining({ message: 'bad' }),
      }),
    ]);
    expect(queues.get(FIX_QUEUE_NAME).sent).toEqual([]);
  });

  test('re-sends the lane without delay when the budget runs out after a page closes, leaving the next page queued', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-11T00:00:00.000Z'));
    const { handleWriter } = await import('./resync-cases-by-date');
    const queues = stubQueues();
    await givenContext();
    seedPage(queues, { events: [caseEvent(CASE_A)] });
    seedPage(queues, { events: [caseEvent(CASE_B)] });
    const exportSpy = stubExportAndLoad((event) => {
      if (event.caseId === CASE_A) event.divisionChange = divisionChange;
    });
    // Publishing A's division change runs while its page is being closed. The clock then passes
    // the budget with no page open.
    vi.spyOn(queues.get(FIX_QUEUE_NAME), 'sendMessage').mockImplementation(async () => {
      vi.setSystemTime(Date.now() + DEFAULT_INVOCATION_BUDGET_MS);
    });

    await handleWriter(writerMessage, makeInvocationContext());

    expect(exportedCaseIds(exportSpy)).toEqual([CASE_A]);
    expect(queues.get(PAGE_QUEUE).sent).toEqual([]);
    expect(queues.get(PAGE_QUEUE).remaining).toEqual([
      JSON.stringify({ events: [caseEvent(CASE_B)] }),
    ]);
    const [laneSend] = queues.get(WRITER_QUEUE).sent;
    expect(JSON.parse(laneSend.text)).toEqual(writerMessage);
    expect(laneSend.visibilityTimeout).toBeUndefined();
  });

  test('keeps pulling pages in one invocation until the page queue is empty', async () => {
    const { handleWriter } = await import('./resync-cases-by-date');
    const queues = stubQueues();
    await givenContext();
    seedPage(queues, { events: [caseEvent(CASE_A)] });
    seedPage(queues, { events: [caseEvent(CASE_B)] });
    const exportSpy = stubExportAndLoad();

    await handleWriter(writerMessage, makeInvocationContext());

    expect(exportedCaseIds(exportSpy)).toEqual([CASE_A, CASE_B]);
    expect(queues.get(PAGE_QUEUE).remaining).toEqual([]);
  });

  test('on a 429 at case k, requeues only cases k onward with the retry count bumped and ends the invocation', async () => {
    const { handleWriter } = await import('./resync-cases-by-date');
    const queues = stubQueues();
    await givenContext();
    seedPage(queues, {
      events: [caseEvent(CASE_A), caseEvent(CASE_B), caseEvent(CASE_C)],
      firstAttemptAt: FIRST_ATTEMPT_AT,
    });
    seedPage(queues, { events: [caseEvent(CASE_D)] });
    const exportSpy = stubExportAndLoad((event) => {
      if (event.caseId === CASE_A) event.divisionChange = divisionChange;
      if (event.caseId === CASE_B) throw new TooManyRequestsError('TEST');
    });

    await handleWriter(writerMessage, makeInvocationContext());

    expect(exportedCaseIds(exportSpy)).toEqual([CASE_A, CASE_B]);
    expect(sentJson(queues.get(PAGE_QUEUE))).toEqual([
      {
        events: [caseEvent(CASE_B), caseEvent(CASE_C)],
        retryCount: 1,
        firstAttemptAt: FIRST_ATTEMPT_AT,
      },
    ]);
    expect(queues.get(PAGE_QUEUE).sent[0].messageTimeToLive).toBe(-1);
    expect(sentJson(queues.get(FIX_QUEUE_NAME))).toEqual([divisionChange]);
    const [laneSend] = queues.get(WRITER_QUEUE).sent;
    expect(JSON.parse(laneSend.text)).toEqual(writerMessage);
    expect(laneSend.visibilityTimeout).toBeGreaterThanOrEqual(5);
    expect(laneSend.visibilityTimeout).toBeLessThanOrEqual(10);
    expect(queues.log.indexOf(`send:${PAGE_QUEUE}`)).toBeLessThan(
      queues.log.indexOf(`delete:${PAGE_QUEUE}`),
    );
  });

  test('on a 429 for a page already at the retry limit, sends the unfinished cases to DLQ and logs a lost-cases event', async () => {
    const { handleWriter } = await import('./resync-cases-by-date');
    const queues = stubQueues();
    const context = await givenContext();
    const completeTraceSpy = vi.spyOn(context.observability, 'completeTrace');
    seedPage(queues, {
      events: [caseEvent(CASE_A), caseEvent(CASE_B), caseEvent(CASE_C)],
      retryCount: RATE_LIMIT_RETRY_LIMIT,
    });
    stubExportAndLoad((event) => {
      if (event.caseId === CASE_B) throw new TooManyRequestsError('TEST');
    });

    await handleWriter(writerMessage, makeInvocationContext());

    expect(queues.get(PAGE_QUEUE).sent).toEqual([]);
    expect(queues.get(PAGE_QUEUE).remaining).toEqual([]);
    expect(sentJson(queues.get(DLQ_QUEUE))).toEqual([
      expect.objectContaining({
        type: 'QUEUE_ERROR',
        retryCount: RATE_LIMIT_RETRY_LIMIT,
        message: {
          events: [caseEvent(CASE_B), caseEvent(CASE_C)],
          retryCount: RATE_LIMIT_RETRY_LIMIT,
          firstAttemptAt: expect.any(String),
        },
      }),
    ]);
    expect(completeTraceSpy).toHaveBeenCalledWith(
      expect.anything(),
      'ResyncCasesByDateLostCases',
      expect.objectContaining({
        success: false,
        properties: expect.objectContaining({ caseIds: `${CASE_B},${CASE_C}` }),
        measurements: { caseCount: 2 },
      }),
      undefined,
      expect.anything(),
    );
  });

  test('logs one structured line per page with its case, put-back, and retry counts', async () => {
    const { handleWriter } = await import('./resync-cases-by-date');
    const queues = stubQueues();
    const context = await givenContext();
    const infoSpy = vi.spyOn(context.logger, 'info');
    seedPage(queues, { events: [caseEvent(CASE_A), caseEvent(CASE_B), caseEvent(CASE_C)] });
    stubExportAndLoad((event) => {
      if (event.caseId === CASE_B) throw new TooManyRequestsError('TEST');
    });

    await handleWriter(writerMessage, makeInvocationContext());

    const pageLine = infoSpy.mock.calls
      .map(([, message]) => String(message))
      .find((message) => message.includes('casesCompleted='));
    expect(pageLine).toEqual(
      expect.stringContaining(
        'casesCompleted=1 casesPutBack=2 msSlept=0 transientCount=1 retryCount=0',
      ),
    );
  });

  test('stops before a case that could cross the invocation budget, puts the open page back, and re-sends the lane without delay', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-11T00:00:00.000Z'));
    const { handleWriter } = await import('./resync-cases-by-date');
    const queues = stubQueues();
    await givenContext();
    seedPage(queues, { events: [caseEvent(CASE_A), caseEvent(CASE_B), caseEvent(CASE_C)] });
    // A single case that uses the whole invocation budget leaves no room for B.
    const slowCaseMs = DEFAULT_INVOCATION_BUDGET_MS;
    const exportSpy = stubExportAndLoad((event) => {
      if (event.caseId === CASE_A) vi.setSystemTime(Date.now() + slowCaseMs);
    });

    await handleWriter(writerMessage, makeInvocationContext());

    expect(exportedCaseIds(exportSpy)).toEqual([CASE_A]);
    expect(sentJson(queues.get(PAGE_QUEUE))).toEqual([
      {
        events: [caseEvent(CASE_B), caseEvent(CASE_C)],
        retryCount: 1,
        firstAttemptAt: expect.any(String),
      },
    ]);
    const [laneSend] = queues.get(WRITER_QUEUE).sent;
    expect(JSON.parse(laneSend.text)).toEqual(writerMessage);
    expect(laneSend.visibilityTimeout).toBeUndefined();
  });

  test('closes the open page and re-sends the lane without an empty-check when the last case runs past the invocation budget', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-11T00:00:00.000Z'));
    const { handleWriter } = await import('./resync-cases-by-date');
    const queues = stubQueues();
    await givenContext();
    seedPage(queues, { events: [caseEvent(CASE_A)] });
    const slowCaseMs = DEFAULT_INVOCATION_BUDGET_MS;
    stubExportAndLoad((event) => {
      if (event.caseId === CASE_A) vi.setSystemTime(Date.now() + slowCaseMs);
    });

    await handleWriter(writerMessage, makeInvocationContext());

    expect(queues.get(PAGE_QUEUE).remaining).toEqual([]);
    expect(queues.get(PAGE_QUEUE).sent).toEqual([]);
    expect(sentJson(queues.get(WRITER_QUEUE))).toEqual([writerMessage]);
  });

  test('puts the open page back when its cases push it past the page lease, then keeps pulling pages in the same invocation', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-11T00:00:00.000Z'));
    const { handleWriter } = await import('./resync-cases-by-date');
    const queues = stubQueues();
    const context = await givenContext();
    const infoSpy = vi.spyOn(context.logger, 'info');
    seedPage(queues, { events: [caseEvent(CASE_A), caseEvent(CASE_B), caseEvent(CASE_C)] });
    seedPage(queues, { events: [caseEvent(CASE_D)] });
    // One 200 s case is past the page lease threshold and far inside the invocation budget.
    const slowCaseMs = 200_000;
    const exportSpy = stubExportAndLoad((event) => {
      if (event.caseId === CASE_A) vi.setSystemTime(Date.now() + slowCaseMs);
    });

    await handleWriter(writerMessage, makeInvocationContext());

    // The put-back page is received again after D, so B and C are synced in the same invocation.
    expect(exportedCaseIds(exportSpy)).toEqual([CASE_A, CASE_D, CASE_B, CASE_C]);
    expect(sentJson(queues.get(PAGE_QUEUE))).toEqual([
      {
        events: [caseEvent(CASE_B), caseEvent(CASE_C)],
        retryCount: 1,
        firstAttemptAt: expect.any(String),
      },
    ]);
    // The only lane message is the empty-queue recheck sent after the lane drained the queue; the
    // lease escape itself did not end the invocation or re-send the lane.
    expect(sentJson(queues.get(WRITER_QUEUE))).toEqual([{ ...writerMessage, emptyChecks: 1 }]);
    const pageLines = infoSpy.mock.calls.map(([, message]) => String(message));
    expect(pageLines).toContainEqual(expect.stringContaining('outcome=lease-expiring'));
  });

  test.each([
    {
      description: 'another lane still holds a page',
      leasedPage: true,
      emptyChecks: undefined,
      expectedLane: { runId: 'run-1', laneId: 2 },
    },
    {
      description: 'the page queue is empty for the first time',
      leasedPage: false,
      emptyChecks: undefined,
      expectedLane: { runId: 'run-1', laneId: 2, emptyChecks: 1 },
    },
    {
      description: 'the page queue was already empty on the previous check',
      leasedPage: false,
      emptyChecks: 1,
      expectedLane: undefined,
    },
  ])(
    'when no page can be received and $description, re-sends the lane only if it has not finished',
    async ({ leasedPage, emptyChecks, expectedLane }) => {
      const { handleWriter } = await import('./resync-cases-by-date');
      const queues = stubQueues();
      await givenContext();
      if (leasedPage) {
        queues
          .get(PAGE_QUEUE)
          .seed(JSON.stringify({ events: [caseEvent(CASE_A)] }), { leased: true });
      }
      const exportSpy = stubExportAndLoad();

      await handleWriter({ ...writerMessage, emptyChecks }, makeInvocationContext());

      expect(exportSpy).not.toHaveBeenCalled();
      expect(sentJson(queues.get(WRITER_QUEUE))).toEqual(expectedLane ? [expectedLane] : []);
      expect(queues.get(WRITER_QUEUE).sent.map((sent) => sent.visibilityTimeout)).toEqual(
        expectedLane ? [30] : [],
      );
    },
  );

  test('sleeps after a case when the lane is ahead of its target rate and records the sleep on the page', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-11T00:00:00.000Z'));
    // Default 40 lanes at 19 RU per case: 7600 RU/s gives 10 cases per second per lane, so one
    // case must be followed by a 100 ms sleep while the clock stays frozen.
    process.env[TARGET_RU_ENV] = '7600';
    const { handleWriter } = await import('./resync-cases-by-date');
    const queues = stubQueues();
    const context = await givenContext();
    const infoSpy = vi.spyOn(context.logger, 'info');
    seedPage(queues, { events: [caseEvent(CASE_A)] });
    stubExportAndLoad();

    await handleWriter(writerMessage, makeInvocationContext());

    const pageLine = infoSpy.mock.calls
      .map(([, message]) => String(message))
      .find((message) => message.includes('casesCompleted='));
    expect(pageLine).toEqual(expect.stringContaining('msSlept=100 '));
    expect(queues.get(PAGE_QUEUE).remaining).toEqual([]);
  });

  test('keeps pulling pages and logs a warning when a page delete reports its lease was already reclaimed', async () => {
    const { handleWriter } = await import('./resync-cases-by-date');
    const queues = stubQueues();
    const context = await givenContext();
    const warnSpy = vi.spyOn(context.logger, 'warn');
    seedPage(queues, { events: [caseEvent(CASE_A)] });
    seedPage(queues, { events: [caseEvent(CASE_B)] });
    const deleteSpy = vi
      .spyOn(queues.get(PAGE_QUEUE), 'deleteMessage')
      .mockResolvedValueOnce(false);
    const exportSpy = stubExportAndLoad();

    await expect(handleWriter(writerMessage, makeInvocationContext())).resolves.toBeUndefined();

    expect(exportedCaseIds(exportSpy)).toEqual([CASE_A, CASE_B]);
    const [reclaimedMessageId] = deleteSpy.mock.calls[0];
    expect(warnSpy.mock.calls.map(([, message]) => String(message))).toContainEqual(
      expect.stringContaining(`runId=run-1 laneId=2 messageId=${reclaimedMessageId}`),
    );
  });

  test('lets a non-transient error from exportAndLoad propagate and leaves the page on the queue', async () => {
    const { handleWriter } = await import('./resync-cases-by-date');
    const queues = stubQueues();
    await givenContext();
    seedPage(queues, { events: [caseEvent(CASE_A)] });
    vi.spyOn(ExportAndLoadCaseModule.default, 'exportAndLoad').mockRejectedValue(
      new Error('Database connection failed'),
    );

    await expect(handleWriter(writerMessage, makeInvocationContext())).rejects.toThrow(
      'Database connection failed',
    );

    expect(queues.log).toEqual([]);
    expect(queues.get(PAGE_QUEUE).remaining).toHaveLength(1);
  });
});

describe('computePacingSleepMs', () => {
  test.each([
    { casesDone: 10, casesPerSec: 5, elapsedMs: 5_000, expected: 0 },
    { casesDone: 10, casesPerSec: 5, elapsedMs: 1_000, expected: 1_000 },
    { casesDone: 1, casesPerSec: 3, elapsedMs: 0, expected: 333 },
  ])(
    'casesDone=$casesDone at $casesPerSec per second after $elapsedMs ms sleeps $expected ms',
    async ({ casesDone, casesPerSec, elapsedMs, expected }) => {
      const { computePacingSleepMs } = await import('./resync-cases-by-date');
      expect(computePacingSleepMs(casesDone, casesPerSec, elapsedMs)).toBe(expected);
    },
  );
});

describe('resync-cases-by-date handleStart page splitting', () => {
  test('splits cases into pages of 100 and sends every page with no expiry', async () => {
    const { handleStart } = await import('./resync-cases-by-date');
    const events: CaseSyncEvent[] = Array.from({ length: 250 }, (_, index) => ({
      type: 'CASE_CHANGED',
      caseId: `001-25-${String(index).padStart(5, '0')}`,
    }));
    vi.spyOn(SyncCasesModule.default, 'getCaseIds').mockResolvedValue({
      events,
      lastCasesSyncDate: '2024-01-01',
      lastTransactionsSyncDate: '2024-01-01',
    });
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );
    const queues = stubQueues();

    await handleStart({ fromDate: '2024-01-01' }, makeInvocationContext());

    const pages = queues.get(PAGE_QUEUE).sent;
    expect(pages.map((page) => JSON.parse(page.text).events.length)).toEqual([100, 100, 50]);
    expect(pages.every((page) => page.messageTimeToLive === -1)).toBe(true);
    expect(JSON.parse(pages[2].text).events.map((event: CaseSyncEvent) => event.caseId)).toEqual(
      events.slice(200).map((event) => event.caseId),
    );
  });
});
