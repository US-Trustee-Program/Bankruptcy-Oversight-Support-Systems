import { describe, test, expect, vi, beforeEach } from 'vitest';
import { InvocationContext } from '@azure/functions';
import * as DataflowTelemetry from '../../lib/use-cases/dataflows/dataflow-telemetry';
import { TooManyRequestsError } from '../../lib/common-errors/too-many-requests-error';
import { StorageQueueHumbleObject } from '../../lib/humble-objects/storage-queue-humble';
import ApplicationContextCreator from '../azure/application-context-creator';
import { createMockApplicationContext } from '../../lib/testing/testing-utilities';
import factory from '../../lib/factory';
import { CaseAppointment } from '@common/cams/trustee-appointments';
import { TrusteeProfessionalId } from '@common/cams/trustee-professional-ids';
import { HealSentinelCaseAppointmentsMessage } from '@common/cams/dataflow-events';
import { MockMongoRepository } from '../../lib/testing/mock-gateways/mock-mongo.repository';
import { SENTINEL_TRUSTEE_ID } from '../../lib/use-cases/dataflows/migrate-case-appointments-constants';

const makeInvocationContext = (): InvocationContext =>
  ({
    invocationId: 'test-id',
    functionName: 'heal-sentinel-case-appointments',
    extraOutputs: new Map(),
    log: vi.fn(),
  }) as unknown as InvocationContext;

const makeMessage = (
  overrides: Partial<HealSentinelCaseAppointmentsMessage> = {},
): HealSentinelCaseAppointmentsMessage => ({
  ...overrides,
});

const makeSentinel = (overrides: Partial<CaseAppointment> = {}): CaseAppointment =>
  ({
    id: `sentinel-${overrides.caseId ?? '001'}`,
    caseId: '081-25-00001',
    trusteeId: SENTINEL_TRUSTEE_ID,
    assignedOn: '2025-01-01T00:00:00.000Z',
    appointedDate: '2025-01-01',
    dateFiled: '2024-06-01',
    chapter: '7',
    courtDivisionCode: '081',
    reason: 'trustee-not-found',
    acmsProfessionalId: 'NY-00063',
    ...overrides,
  }) as CaseAppointment;

const makeProfessionalId = (
  overrides: Partial<TrusteeProfessionalId> = {},
): TrusteeProfessionalId =>
  ({
    id: 'prof-id-1',
    documentType: 'TRUSTEE_PROFESSIONAL_ID',
    camsTrusteeId: 'trustee-resolved',
    acmsProfessionalId: 'NY-00063',
    createdOn: '2025-01-01T00:00:00.000Z',
    updatedOn: '2025-01-01T00:00:00.000Z',
    ...overrides,
  }) as TrusteeProfessionalId;

describe('heal-sentinel-case-appointments handleHeal', () => {
  let mockFindSentinelAppointments: ReturnType<typeof vi.fn>;
  let mockFindByAcmsProfessionalId: ReturnType<typeof vi.fn>;
  let mockUpsert: ReturnType<typeof vi.fn>;
  let mockDelete: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.AzureWebJobsDataflowsStorage = 'DefaultEndpointsProtocol=https://test';

    mockFindSentinelAppointments = vi.fn().mockResolvedValue([]);
    mockFindByAcmsProfessionalId = vi.fn().mockResolvedValue([]);
    mockUpsert = vi.fn().mockResolvedValue({});
    mockDelete = vi.fn().mockResolvedValue(undefined);

    vi.spyOn(factory, 'getTrusteeCaseAppointmentsRepository').mockReturnValue(
      Object.assign(new MockMongoRepository(), {
        findSentinelAppointments: mockFindSentinelAppointments,
        upsert: mockUpsert,
        delete: mockDelete,
      }),
    );
    vi.spyOn(factory, 'getTrusteeProfessionalIdsRepository').mockReturnValue(
      Object.assign(new MockMongoRepository(), {
        findByAcmsProfessionalId: mockFindByAcmsProfessionalId,
      }),
    );
  });

  test('heals a matched sentinel: upserts the resolved appointment then deletes the sentinel', async () => {
    const { handleHeal } = await import('./heal-sentinel-case-appointments');
    const sentinel = makeSentinel();
    mockFindSentinelAppointments.mockResolvedValue([sentinel]);
    mockFindByAcmsProfessionalId.mockResolvedValue([makeProfessionalId()]);
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );
    const telemetrySpy = vi.spyOn(DataflowTelemetry, 'completeDataflowTrace');
    const mockSendMessage = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(StorageQueueHumbleObject, 'fromConnectionString').mockReturnValue({
      sendMessage: mockSendMessage,
    } as unknown as StorageQueueHumbleObject);

    await handleHeal(makeMessage(), makeInvocationContext());

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ caseId: sentinel.caseId, trusteeId: 'trustee-resolved' }),
    );
    expect(mockDelete).toHaveBeenCalledWith(sentinel.id);
    expect(telemetrySpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'HEAL-SENTINEL-CASE-APPOINTMENTS',
      'handleHeal',
      expect.anything(),
      expect.objectContaining({ success: true, documentsWritten: 1, documentsFailed: 0 }),
    );
  });

  test('requeues a continuation when the page returned any sentinel rows (more may remain)', async () => {
    const { handleHeal } = await import('./heal-sentinel-case-appointments');
    const sentinel = makeSentinel();
    mockFindSentinelAppointments.mockResolvedValue([sentinel]);
    mockFindByAcmsProfessionalId.mockResolvedValue([makeProfessionalId()]);
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );
    const mockSendMessage = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(StorageQueueHumbleObject, 'fromConnectionString').mockReturnValue({
      sendMessage: mockSendMessage,
    } as unknown as StorageQueueHumbleObject);

    const message = makeMessage();
    await handleHeal(message, makeInvocationContext());

    expect(mockSendMessage).toHaveBeenCalledWith(JSON.stringify(message));
  });

  test('does not requeue when the page is empty (no sentinels left)', async () => {
    const { handleHeal } = await import('./heal-sentinel-case-appointments');
    mockFindSentinelAppointments.mockResolvedValue([]);
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );
    const mockSendMessage = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(StorageQueueHumbleObject, 'fromConnectionString').mockReturnValue({
      sendMessage: mockSendMessage,
    } as unknown as StorageQueueHumbleObject);
    const telemetrySpy = vi.spyOn(DataflowTelemetry, 'completeDataflowTrace');

    await handleHeal(makeMessage(), makeInvocationContext());

    expect(mockSendMessage).not.toHaveBeenCalled();
    expect(telemetrySpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'HEAL-SENTINEL-CASE-APPOINTMENTS',
      'handleHeal',
      expect.anything(),
      expect.objectContaining({ success: true, documentsWritten: 0, documentsFailed: 0 }),
    );
  });

  test('should re-enqueue with backoff and emit rate-limited-requeued telemetry on 429 error', async () => {
    const { handleHeal } = await import('./heal-sentinel-case-appointments');
    const tooManyError = new TooManyRequestsError('HEAL-SENTINEL-CASE-APPOINTMENTS');
    mockFindSentinelAppointments.mockRejectedValue(tooManyError);
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );
    const mockSendMessage = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(StorageQueueHumbleObject, 'fromConnectionString').mockReturnValue({
      sendMessage: mockSendMessage,
    } as unknown as StorageQueueHumbleObject);
    const telemetrySpy = vi.spyOn(DataflowTelemetry, 'completeDataflowTrace');

    await handleHeal(makeMessage({ retryCount: 0 }), makeInvocationContext());

    expect(mockSendMessage).toHaveBeenCalled();
    expect(telemetrySpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'HEAL-SENTINEL-CASE-APPOINTMENTS',
      'handleHeal',
      expect.anything(),
      expect.objectContaining({ success: false, error: 'rate-limited-requeued' }),
    );
  });

  test('should route to DLQ and emit telemetry when retry limit exhausted', async () => {
    const { handleHeal } = await import('./heal-sentinel-case-appointments');
    const tooManyError = new TooManyRequestsError('HEAL-SENTINEL-CASE-APPOINTMENTS');
    mockFindSentinelAppointments.mockRejectedValue(tooManyError);
    const mockContext = await createMockApplicationContext();
    const extraOutputsSetSpy = vi.spyOn(mockContext.extraOutputs, 'set');
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);
    const telemetrySpy = vi.spyOn(DataflowTelemetry, 'completeDataflowTrace');

    await handleHeal(makeMessage({ retryCount: 10 }), makeInvocationContext());

    expect(extraOutputsSetSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queueName: expect.stringContaining('dlq') }),
      expect.anything(),
    );
    expect(telemetrySpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'HEAL-SENTINEL-CASE-APPOINTMENTS',
      'handleHeal',
      expect.anything(),
      expect.objectContaining({
        success: false,
        documentsFailed: 1,
        error: 'rate-limit-retry-exhausted',
      }),
    );
  });

  test('rethrows non-rate-limit errors', async () => {
    const { handleHeal } = await import('./heal-sentinel-case-appointments');
    mockFindSentinelAppointments.mockRejectedValue(new Error('boom'));
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );

    await expect(handleHeal(makeMessage(), makeInvocationContext())).rejects.toThrow('boom');
  });

  test('throws when AzureWebJobsDataflowsStorage is not configured', async () => {
    delete process.env.AzureWebJobsDataflowsStorage;
    const { handleHeal } = await import('./heal-sentinel-case-appointments');

    await expect(handleHeal(makeMessage(), makeInvocationContext())).rejects.toThrow(
      'Missing required environment variable: AzureWebJobsDataflowsStorage',
    );
  });
});
