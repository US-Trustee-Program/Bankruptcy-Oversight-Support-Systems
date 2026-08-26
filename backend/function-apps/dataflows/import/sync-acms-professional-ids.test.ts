import { describe, test, expect, vi, beforeEach } from 'vitest';
import { InvocationContext } from '@azure/functions';
import * as SyncAcmsProfessionalIdsModule from '../../../lib/use-cases/dataflows/sync-acms-professional-ids';
import * as DataflowTelemetry from '../../../lib/use-cases/dataflows/dataflow-telemetry';
import { StorageQueueHumbleObject } from '../../../lib/humble-objects/storage-queue-humble';
import ApplicationContextCreator from '../../azure/application-context-creator';
import { createMockApplicationContext } from '../../../lib/testing/testing-utilities';
import { AcmsTrusteeProfessionalDetailRecord } from '../../../lib/use-cases/gateways.types';
import { TooManyRequestsError } from '../../../lib/common-errors/too-many-requests-error';
import { CamsError } from '../../../lib/common-errors/cams-error';

const makeInvocationContext = (): InvocationContext =>
  ({
    invocationId: 'test-id',
    functionName: 'sync-acms-professional-ids',
    extraOutputs: new Map(),
    log: vi.fn(),
  }) as unknown as InvocationContext;

const makeRecord = (ustProfCode: number): AcmsTrusteeProfessionalDetailRecord => ({
  acmsProfessionalId: `NY-${String(ustProfCode).padStart(5, '0')}`,
  ustProfCode,
  firstName: 'John',
  lastName: 'Smith',
});

describe('sync-acms-professional-ids timerTrigger', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test('should enqueue a START message and emit success telemetry', async () => {
    const { timerTrigger } = await import('./sync-acms-professional-ids');
    const invocationContext = makeInvocationContext();
    const extraOutputsSetSpy = vi.spyOn(invocationContext.extraOutputs, 'set');
    const telemetrySpy = vi.spyOn(DataflowTelemetry, 'completeDataflowTrace');

    await timerTrigger(null, invocationContext);

    expect(extraOutputsSetSpy).toHaveBeenCalledWith(expect.anything(), {});
    expect(telemetrySpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'SYNC-ACMS-PROFESSIONAL-IDS',
      'timerTrigger',
      expect.anything(),
      expect.objectContaining({ success: true }),
    );
  });
});

describe('sync-acms-professional-ids handleStart', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.AzureWebJobsDataflowsStorage = 'DefaultEndpointsProtocol=https://test';
  });

  async function setupMocks(overrides?: { groupDesignators?: string[] }) {
    const mockContext = await createMockApplicationContext();
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);
    vi.spyOn(SyncAcmsProfessionalIdsModule.default, 'getGroupDesignators').mockResolvedValue(
      overrides?.groupDesignators ?? ['NY', 'UT'],
    );
    vi.spyOn(SyncAcmsProfessionalIdsModule.default, 'resolveSyncState').mockResolvedValue({
      id: 'state-1',
      documentType: 'ACMS_PROFESSIONAL_ID_SYNC_STATE',
      lastUstProfCodeByGroup: {},
    });
    vi.spyOn(SyncAcmsProfessionalIdsModule.default, 'purgeAll').mockResolvedValue(undefined);
    const mockSendMessage = vi.fn().mockResolvedValue(undefined);
    const fromConnectionStringSpy = vi
      .spyOn(StorageQueueHumbleObject, 'fromConnectionString')
      .mockReturnValue({ sendMessage: mockSendMessage } as unknown as StorageQueueHumbleObject);
    return { mockContext, mockSendMessage, fromConnectionStringSpy };
  }

  test('should queue one page message per group and emit success telemetry', async () => {
    const { handleStart } = await import('./sync-acms-professional-ids');
    const invocationContext = makeInvocationContext();
    const telemetrySpy = vi.spyOn(DataflowTelemetry, 'completeDataflowTrace');
    const { mockSendMessage } = await setupMocks({ groupDesignators: ['NY', 'UT', 'AK'] });

    await handleStart({}, invocationContext);

    expect(mockSendMessage).toHaveBeenCalledTimes(3);
    expect(telemetrySpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'SYNC-ACMS-PROFESSIONAL-IDS',
      'handleStart',
      expect.anything(),
      expect.objectContaining({ success: true }),
    );
  });

  test('should include each groupDesignator and its bookmark in the queued page message', async () => {
    const { handleStart } = await import('./sync-acms-professional-ids');
    const invocationContext = makeInvocationContext();
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );
    vi.spyOn(SyncAcmsProfessionalIdsModule.default, 'getGroupDesignators').mockResolvedValue([
      'NY',
    ]);
    vi.spyOn(SyncAcmsProfessionalIdsModule.default, 'resolveSyncState').mockResolvedValue({
      id: 'state-1',
      documentType: 'ACMS_PROFESSIONAL_ID_SYNC_STATE',
      lastUstProfCodeByGroup: { NY: 63 },
    });
    const mockSendMessage = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(StorageQueueHumbleObject, 'fromConnectionString').mockReturnValue({
      sendMessage: mockSendMessage,
    } as unknown as StorageQueueHumbleObject);

    await handleStart({}, invocationContext);

    expect(mockSendMessage).toHaveBeenCalledWith(
      JSON.stringify({ groupDesignator: 'NY', lastUstProfCode: 63 }),
    );
  });

  test('should purge existing professional IDs and reset the bookmark when the purge flag is set', async () => {
    const { handleStart } = await import('./sync-acms-professional-ids');
    const invocationContext = makeInvocationContext();
    await setupMocks({ groupDesignators: ['NY'] });

    await handleStart({ purge: true }, invocationContext);

    expect(SyncAcmsProfessionalIdsModule.default.purgeAll).toHaveBeenCalled();
    expect(SyncAcmsProfessionalIdsModule.default.resolveSyncState).toHaveBeenCalledWith(
      expect.anything(),
      'NY',
      true,
    );
  });

  test('should route to DLQ when AzureWebJobsDataflowsStorage is not configured', async () => {
    delete process.env.AzureWebJobsDataflowsStorage;
    const { handleStart } = await import('./sync-acms-professional-ids');
    const invocationContext = makeInvocationContext();
    const extraOutputsSetSpy = vi.spyOn(invocationContext.extraOutputs, 'set');
    await setupMocks();

    await handleStart({}, invocationContext);

    expect(extraOutputsSetSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        type: 'QUEUE_ERROR',
        error: expect.objectContaining({
          message: expect.stringContaining('AzureWebJobsDataflowsStorage'),
        }),
      }),
    );
  });
});

describe('sync-acms-professional-ids handlePage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.AzureWebJobsDataflowsStorage = 'DefaultEndpointsProtocol=https://test';
  });

  /**
   * A cursor-aware fake for getTrusteeProfessionalRecordsPage, keyed by the incoming
   * lastUstProfCode argument — unlike a fixed mockResolvedValueOnce sequence, this actually
   * fails if handlePage's loop doesn't thread the advancing cursor into each subsequent call
   * (e.g. re-fetching from the same starting bookmark, or advancing by the wrong amount).
   */
  function makeCursorAwarePageFetcher(pages: ReturnType<typeof makeRecord>[][]) {
    const byStartingCursor = new Map<number, ReturnType<typeof makeRecord>[]>();
    let cursor = 0;
    for (const page of pages) {
      byStartingCursor.set(cursor, page);
      cursor = page.length > 0 ? page[page.length - 1].ustProfCode : cursor;
    }
    return vi.fn(
      async (_ctx: unknown, _group: string, lastUstProfCode: number) =>
        byStartingCursor.get(lastUstProfCode) ?? [],
    );
  }

  test('should page through all records for the group and emit success telemetry', async () => {
    const { handlePage } = await import('./sync-acms-professional-ids');
    const invocationContext = makeInvocationContext();
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );

    const page1 = [makeRecord(1), makeRecord(2)];
    const getPageSpy = makeCursorAwarePageFetcher([page1, []]);
    vi.spyOn(SyncAcmsProfessionalIdsModule.default, 'createDeps').mockReturnValue({
      context: {} as never,
      acmsGateway: { getTrusteeProfessionalRecordsPage: getPageSpy } as never,
      officesGateway: {} as never,
      trusteesRepo: {} as never,
      variationRepo: {} as never,
      professionalIdsRepo: {} as never,
      runtimeStateRepo: {} as never,
    });
    vi.spyOn(SyncAcmsProfessionalIdsModule.default, 'processOneRecord').mockResolvedValue({
      kind: 'auto-linked',
      via: 'fingerprint',
    });
    vi.spyOn(SyncAcmsProfessionalIdsModule.default, 'storeRuntimeState').mockResolvedValue(
      undefined,
    );
    const telemetrySpy = vi.spyOn(DataflowTelemetry, 'completeDataflowTrace');

    await handlePage({ groupDesignator: 'NY', lastUstProfCode: 0 }, invocationContext);

    expect(getPageSpy).toHaveBeenCalledTimes(2);
    expect(getPageSpy).toHaveBeenNthCalledWith(1, expect.anything(), 'NY', 0, expect.any(Number));
    expect(getPageSpy).toHaveBeenNthCalledWith(2, expect.anything(), 'NY', 2, expect.any(Number));
    expect(SyncAcmsProfessionalIdsModule.default.processOneRecord).toHaveBeenCalledTimes(2);
    expect(telemetrySpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'SYNC-ACMS-PROFESSIONAL-IDS',
      'handlePage',
      expect.anything(),
      expect.objectContaining({ success: true, documentsWritten: 2 }),
    );
  });

  test('should thread the advancing cursor across three or more pages, not just a hardcoded two calls', async () => {
    const { handlePage } = await import('./sync-acms-professional-ids');
    const invocationContext = makeInvocationContext();
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );

    const page1 = [makeRecord(1), makeRecord(2)];
    const page2 = [makeRecord(3), makeRecord(4)];
    const page3 = [makeRecord(5)];
    const getPageSpy = makeCursorAwarePageFetcher([page1, page2, page3, []]);
    vi.spyOn(SyncAcmsProfessionalIdsModule.default, 'createDeps').mockReturnValue({
      context: {} as never,
      acmsGateway: { getTrusteeProfessionalRecordsPage: getPageSpy } as never,
      officesGateway: {} as never,
      trusteesRepo: {} as never,
      variationRepo: {} as never,
      professionalIdsRepo: {} as never,
      runtimeStateRepo: {} as never,
    });
    vi.spyOn(SyncAcmsProfessionalIdsModule.default, 'processOneRecord').mockResolvedValue({
      kind: 'auto-linked',
      via: 'fingerprint',
    });
    const storeSpy = vi
      .spyOn(SyncAcmsProfessionalIdsModule.default, 'storeRuntimeState')
      .mockResolvedValue(undefined);

    await handlePage({ groupDesignator: 'NY', lastUstProfCode: 0 }, invocationContext);

    expect(getPageSpy).toHaveBeenCalledTimes(4);
    expect(getPageSpy).toHaveBeenNthCalledWith(1, expect.anything(), 'NY', 0, expect.any(Number));
    expect(getPageSpy).toHaveBeenNthCalledWith(2, expect.anything(), 'NY', 2, expect.any(Number));
    expect(getPageSpy).toHaveBeenNthCalledWith(3, expect.anything(), 'NY', 4, expect.any(Number));
    expect(getPageSpy).toHaveBeenNthCalledWith(4, expect.anything(), 'NY', 5, expect.any(Number));
    expect(SyncAcmsProfessionalIdsModule.default.processOneRecord).toHaveBeenCalledTimes(5);
    expect(storeSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ lastUstProfCodeByGroup: { NY: 5 } }),
    );
  });

  test('should advance and persist the bookmark to the last processed UST_PROF_CODE', async () => {
    const { handlePage } = await import('./sync-acms-professional-ids');
    const invocationContext = makeInvocationContext();
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );
    const getPageSpy = makeCursorAwarePageFetcher([[makeRecord(5), makeRecord(9)], []]);
    vi.spyOn(SyncAcmsProfessionalIdsModule.default, 'createDeps').mockReturnValue({
      context: {} as never,
      acmsGateway: { getTrusteeProfessionalRecordsPage: getPageSpy } as never,
      officesGateway: {} as never,
      trusteesRepo: {} as never,
      variationRepo: {} as never,
      professionalIdsRepo: {} as never,
      runtimeStateRepo: {} as never,
    });
    vi.spyOn(SyncAcmsProfessionalIdsModule.default, 'processOneRecord').mockResolvedValue({
      kind: 'auto-linked',
      via: 'fingerprint',
    });
    const storeSpy = vi
      .spyOn(SyncAcmsProfessionalIdsModule.default, 'storeRuntimeState')
      .mockResolvedValue(undefined);

    await handlePage({ groupDesignator: 'NY', lastUstProfCode: 0 }, invocationContext);

    expect(storeSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ lastUstProfCodeByGroup: { NY: 9 } }),
    );
  });

  test('should throw when AzureWebJobsDataflowsStorage is not configured', async () => {
    delete process.env.AzureWebJobsDataflowsStorage;
    const { handlePage } = await import('./sync-acms-professional-ids');
    const invocationContext = makeInvocationContext();

    await expect(
      handlePage({ groupDesignator: 'NY', lastUstProfCode: 0 }, invocationContext),
    ).rejects.toThrow('Missing required environment variable');
  });

  test('should re-enqueue with backoff and emit rate-limited-requeued telemetry on 429 error', async () => {
    const { handlePage } = await import('./sync-acms-professional-ids');
    const message = { groupDesignator: 'NY', lastUstProfCode: 0, retryCount: 0 };
    const invocationContext = makeInvocationContext();

    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );
    const tooManyError = new TooManyRequestsError('SYNC-ACMS-PROFESSIONAL-IDS');
    vi.spyOn(SyncAcmsProfessionalIdsModule.default, 'createDeps').mockReturnValue({
      context: {} as never,
      acmsGateway: {
        getTrusteeProfessionalRecordsPage: vi.fn().mockRejectedValue(tooManyError),
      } as never,
      officesGateway: {} as never,
      trusteesRepo: {} as never,
      variationRepo: {} as never,
      professionalIdsRepo: {} as never,
      runtimeStateRepo: {} as never,
    });
    const mockSendMessage = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(StorageQueueHumbleObject, 'fromConnectionString').mockReturnValue({
      sendMessage: mockSendMessage,
    } as unknown as StorageQueueHumbleObject);
    const telemetrySpy = vi.spyOn(DataflowTelemetry, 'completeDataflowTrace');

    await handlePage(message, invocationContext);

    expect(mockSendMessage).toHaveBeenCalled();
    expect(telemetrySpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'SYNC-ACMS-PROFESSIONAL-IDS',
      'handlePage',
      expect.anything(),
      expect.objectContaining({ success: false, error: 'rate-limited-requeued' }),
    );
  });

  test('should resume the retry from the original starting bookmark, not any locally-advanced progress', async () => {
    const { handlePage } = await import('./sync-acms-professional-ids');
    const message = { groupDesignator: 'NY', lastUstProfCode: 0, retryCount: 0 };
    const invocationContext = makeInvocationContext();

    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );
    const tooManyError = new TooManyRequestsError('SYNC-ACMS-PROFESSIONAL-IDS');
    const getPageSpy = vi
      .fn()
      .mockResolvedValueOnce([makeRecord(1), makeRecord(2)])
      .mockRejectedValueOnce(tooManyError);
    vi.spyOn(SyncAcmsProfessionalIdsModule.default, 'createDeps').mockReturnValue({
      context: {} as never,
      acmsGateway: { getTrusteeProfessionalRecordsPage: getPageSpy } as never,
      officesGateway: {} as never,
      trusteesRepo: {} as never,
      variationRepo: {} as never,
      professionalIdsRepo: {} as never,
      runtimeStateRepo: {} as never,
    });
    vi.spyOn(SyncAcmsProfessionalIdsModule.default, 'processOneRecord').mockResolvedValue({
      kind: 'auto-linked',
      via: 'fingerprint',
    });
    const mockSendMessage = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(StorageQueueHumbleObject, 'fromConnectionString').mockReturnValue({
      sendMessage: mockSendMessage,
    } as unknown as StorageQueueHumbleObject);

    await handlePage(message, invocationContext);

    // Confirms the local bookmark genuinely advanced past the original before the retry was
    // triggered — without this, the assertion below wouldn't distinguish "resumes from the
    // original bookmark" from "never advanced locally in the first place."
    expect(SyncAcmsProfessionalIdsModule.default.processOneRecord).toHaveBeenCalledTimes(2);
    const [sentBody] = mockSendMessage.mock.calls[0];
    const sentMessage = JSON.parse(sentBody as string);
    expect(sentMessage.lastUstProfCode).toBe(0);
  });

  test('should route to DLQ and emit telemetry when retry limit exhausted', async () => {
    const { handlePage } = await import('./sync-acms-professional-ids');
    const message = { groupDesignator: 'NY', lastUstProfCode: 0, retryCount: 10 };
    const invocationContext = makeInvocationContext();

    const mockContext = await createMockApplicationContext();
    const extraOutputsSetSpy = vi.spyOn(mockContext.extraOutputs, 'set');
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);
    const tooManyError = new TooManyRequestsError('SYNC-ACMS-PROFESSIONAL-IDS');
    vi.spyOn(SyncAcmsProfessionalIdsModule.default, 'createDeps').mockReturnValue({
      context: {} as never,
      acmsGateway: {
        getTrusteeProfessionalRecordsPage: vi.fn().mockRejectedValue(tooManyError),
      } as never,
      officesGateway: {} as never,
      trusteesRepo: {} as never,
      variationRepo: {} as never,
      professionalIdsRepo: {} as never,
      runtimeStateRepo: {} as never,
    });
    const telemetrySpy = vi.spyOn(DataflowTelemetry, 'completeDataflowTrace');

    await handlePage(message, invocationContext);

    expect(extraOutputsSetSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queueName: expect.stringContaining('dlq') }),
      expect.anything(),
    );
    expect(telemetrySpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'SYNC-ACMS-PROFESSIONAL-IDS',
      'handlePage',
      expect.anything(),
      expect.objectContaining({ success: false, error: 'rate-limit-retry-exhausted' }),
    );
  });

  test('should re-throw on non-rate-limit errors', async () => {
    const { handlePage } = await import('./sync-acms-professional-ids');
    const message = { groupDesignator: 'NY', lastUstProfCode: 0 };
    const invocationContext = makeInvocationContext();

    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );
    const error = new CamsError('SYNC-ACMS-PROFESSIONAL-IDS', { message: 'Database error' });
    vi.spyOn(SyncAcmsProfessionalIdsModule.default, 'createDeps').mockReturnValue({
      context: {} as never,
      acmsGateway: {
        getTrusteeProfessionalRecordsPage: vi.fn().mockRejectedValue(error),
      } as never,
      officesGateway: {} as never,
      trusteesRepo: {} as never,
      variationRepo: {} as never,
      professionalIdsRepo: {} as never,
      runtimeStateRepo: {} as never,
    });

    await expect(handlePage(message, invocationContext)).rejects.toThrow('Database error');
  });
});
