import { describe, test, expect, vi, beforeEach } from 'vitest';
import { InvocationContext } from '@azure/functions';
import * as SyncAcmsProfessionalIdsModule from '../../../lib/use-cases/dataflows/sync-acms-professional-ids';
import * as DataflowTelemetry from '../../../lib/use-cases/dataflows/dataflow-telemetry';
import { StorageQueueHumbleObject } from '../../../lib/humble-objects/storage-queue-humble';
import ApplicationContextCreator from '../../azure/application-context-creator';
import { createMockApplicationContext } from '../../../lib/testing/testing-utilities';
import { TooManyRequestsError } from '../../../lib/common-errors/too-many-requests-error';
import { CamsError } from '../../../lib/common-errors/cams-error';

const makeInvocationContext = (): InvocationContext =>
  ({
    invocationId: 'test-id',
    functionName: 'sync-acms-professional-ids',
    extraOutputs: new Map(),
    log: vi.fn(),
  }) as unknown as InvocationContext;

// This trigger's own retry-with-backoff/DLQ-on-exhaustion orchestration has no equivalent at the
// use-cases layer (sync-acms-professional-ids.ts rethrows a transient error and documents that
// the caller owns retry) - everything else this trigger does (queue message shape, telemetry,
// purge propagation, bookmark advancement) duplicates coverage already exercised directly against
// SyncAcmsProfessionalIds in lib/use-cases/dataflows/sync-acms-professional-ids.test.ts.
describe('sync-acms-professional-ids handlePage retry/DLQ', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.AzureWebJobsDataflowsStorage = 'DefaultEndpointsProtocol=https://test';
  });

  test('should re-enqueue with backoff and emit rate-limited-requeued telemetry on 429 error', async () => {
    const { handlePage } = await import('./sync-acms-professional-ids');
    const message = {
      groupDesignator: 'NY',
      lastUstProfCode: 0,
      remainingGroups: [],
      retryCount: 0,
    };
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
    const message = {
      groupDesignator: 'NY',
      lastUstProfCode: 0,
      remainingGroups: [],
      retryCount: 0,
    };
    const invocationContext = makeInvocationContext();

    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );
    const tooManyError = new TooManyRequestsError('SYNC-ACMS-PROFESSIONAL-IDS');
    const getPageSpy = vi.fn().mockResolvedValue([
      { acmsProfessionalId: 'NY-00001', ustProfCode: 1, firstName: 'John', lastName: 'Smith' },
      { acmsProfessionalId: 'NY-00002', ustProfCode: 2, firstName: 'John', lastName: 'Smith' },
    ]);
    vi.spyOn(SyncAcmsProfessionalIdsModule.default, 'createDeps').mockReturnValue({
      context: {} as never,
      acmsGateway: { getTrusteeProfessionalRecordsPage: getPageSpy } as never,
      officesGateway: {} as never,
      trusteesRepo: {} as never,
      variationRepo: {} as never,
      professionalIdsRepo: {} as never,
      runtimeStateRepo: {} as never,
    });
    // The error surfaces from processing the page's records (not a second page
    // fetch) — with one page per invocation, that's the only way a transient
    // error can occur after some local progress has already been made.
    vi.spyOn(SyncAcmsProfessionalIdsModule.default, 'processOneRecord')
      .mockResolvedValueOnce({ kind: 'auto-linked', via: 'fingerprint' })
      .mockRejectedValueOnce(tooManyError);
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
    const message = {
      groupDesignator: 'NY',
      lastUstProfCode: 0,
      remainingGroups: [],
      retryCount: 10,
    };
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
    const message = { groupDesignator: 'NY', lastUstProfCode: 0, remainingGroups: [] };
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
