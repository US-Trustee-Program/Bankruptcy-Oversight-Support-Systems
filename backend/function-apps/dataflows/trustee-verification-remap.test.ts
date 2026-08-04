import { describe, test, expect, vi, beforeEach, Mock } from 'vitest';
import { InvocationContext } from '@azure/functions';
import * as DataflowTelemetry from '../../lib/use-cases/dataflows/dataflow-telemetry';
import { TooManyRequestsError } from '../../lib/common-errors/too-many-requests-error';
import { StorageQueueHumbleObject } from '../../lib/humble-objects/storage-queue-humble';
import ApplicationContextCreator from '../azure/application-context-creator';
import { createMockApplicationContext } from '../../lib/testing/testing-utilities';
import factory from '../../lib/factory';
import { CaseAppointment } from '@common/cams/trustee-appointments';
import {
  TrusteeAppointmentDownstreamEvent,
  TrusteeVerificationRemapMessage,
} from '@common/cams/dataflow-events';
import { MockMongoRepository } from '../../lib/testing/mock-gateways/mock-mongo.repository';

const makeInvocationContext = (): InvocationContext =>
  ({
    invocationId: 'test-id',
    functionName: 'trustee-verification-remap',
    extraOutputs: new Map(),
    log: vi.fn(),
  }) as unknown as InvocationContext;

const makeMessage = (
  overrides: Partial<TrusteeVerificationRemapMessage> = {},
): TrusteeVerificationRemapMessage => ({
  fingerprint: 'fp-abc123',
  resolvedTrusteeId: 'trustee-new',
  resolvedTrusteeName: 'New Trustee',
  verificationId: 'verification-1',
  ...overrides,
});

const makeSurrogate = (overrides: Partial<CaseAppointment> = {}): CaseAppointment =>
  ({
    id: `surrogate-${overrides.caseId ?? '001'}`,
    caseId: '081-25-00001',
    trusteeId: 'fp-abc123',
    assignedOn: '2025-01-01T00:00:00.000Z',
    appointedDate: '2025-01-01',
    dateFiled: '2024-06-01',
    chapter: '7',
    courtDivisionCode: '081',
    isSurrogate: true,
    variant: '{"firstName":"john","lastName":"doe"}',
    ...overrides,
  }) as CaseAppointment;

describe('trustee-verification-remap handleRemap', () => {
  let mockGetActiveByTrusteeIdFromTrusteePartition: ReturnType<typeof vi.fn>;
  let mockGetActiveByCaseId: ReturnType<typeof vi.fn>;
  let mockUpdateCaseAppointment: ReturnType<typeof vi.fn>;
  let mockUpsert: ReturnType<typeof vi.fn>;
  let mockDelete: ReturnType<typeof vi.fn>;
  let mockQueueTrusteeAppointmentEvent: Mock<
    (event: TrusteeAppointmentDownstreamEvent) => Promise<void>
  >;

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.AzureWebJobsDataflowsStorage = 'DefaultEndpointsProtocol=https://test';

    mockGetActiveByTrusteeIdFromTrusteePartition = vi.fn().mockResolvedValue([]);
    mockGetActiveByCaseId = vi.fn().mockResolvedValue(null);
    mockUpdateCaseAppointment = vi.fn().mockResolvedValue({});
    mockUpsert = vi.fn().mockResolvedValue({});
    mockDelete = vi.fn().mockResolvedValue(undefined);
    mockQueueTrusteeAppointmentEvent = vi.fn().mockResolvedValue(undefined);

    vi.spyOn(factory, 'getTrusteeCaseAppointmentsRepository').mockReturnValue(
      Object.assign(new MockMongoRepository(), {
        getActiveByTrusteeIdFromTrusteePartition: mockGetActiveByTrusteeIdFromTrusteePartition,
        getActiveByCaseId: mockGetActiveByCaseId,
        updateCaseAppointment: mockUpdateCaseAppointment,
        upsert: mockUpsert,
        delete: mockDelete,
      }),
    );
    vi.spyOn(factory, 'getApiToDataflowsGateway').mockReturnValue({
      queueTrusteeAppointmentEvent: mockQueueTrusteeAppointmentEvent,
      queueCaseAssignmentEvent: vi.fn(),
      queueCaseReload: vi.fn(),
      queueTrusteeVerificationRemap: vi.fn(),
    });
  });

  test('remaps a single surrogate case (N=1): upserts canonical appointment then deletes surrogate', async () => {
    const { handleRemap } = await import('./trustee-verification-remap');
    const surrogate = makeSurrogate();
    mockGetActiveByTrusteeIdFromTrusteePartition.mockResolvedValue([surrogate]);
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );
    const telemetrySpy = vi.spyOn(DataflowTelemetry, 'completeDataflowTrace');

    await handleRemap(makeMessage(), makeInvocationContext());

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        caseId: surrogate.caseId,
        trusteeId: 'trustee-new',
        assignedOn: surrogate.assignedOn,
        appointedDate: surrogate.appointedDate,
        dateFiled: surrogate.dateFiled,
        chapter: surrogate.chapter,
        courtDivisionCode: surrogate.courtDivisionCode,
      }),
    );
    expect(mockUpsert.mock.calls[0][0]).not.toHaveProperty('isSurrogate');
    expect(mockUpsert.mock.calls[0][0]).not.toHaveProperty('variant');
    expect(mockDelete).toHaveBeenCalledWith(surrogate.id);
    const upsertOrder = mockUpsert.mock.invocationCallOrder[0];
    const deleteOrder = mockDelete.mock.invocationCallOrder[0];
    expect(upsertOrder).toBeLessThan(deleteOrder);

    expect(telemetrySpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'TRUSTEE-MATCH-VERIFICATION-REMAP',
      'handleRemap',
      expect.anything(),
      expect.objectContaining({ success: true, documentsWritten: 1, documentsFailed: 0 }),
    );
  });

  test('remaps every surrogate case sharing the fingerprint (N>1)', async () => {
    const { handleRemap } = await import('./trustee-verification-remap');
    const surrogateA = makeSurrogate({ id: 'surrogate-a', caseId: '081-25-00001' });
    const surrogateB = makeSurrogate({ id: 'surrogate-b', caseId: '081-25-00002' });
    mockGetActiveByTrusteeIdFromTrusteePartition.mockResolvedValue([surrogateA, surrogateB]);
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );
    const telemetrySpy = vi.spyOn(DataflowTelemetry, 'completeDataflowTrace');

    await handleRemap(makeMessage(), makeInvocationContext());

    expect(mockUpsert).toHaveBeenCalledTimes(2);
    expect(mockDelete).toHaveBeenCalledWith('surrogate-a');
    expect(mockDelete).toHaveBeenCalledWith('surrogate-b');
    expect(telemetrySpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'TRUSTEE-MATCH-VERIFICATION-REMAP',
      'handleRemap',
      expect.anything(),
      expect.objectContaining({ success: true, documentsWritten: 2, documentsFailed: 0 }),
    );
  });

  test('filters out non-surrogate rows returned by the trustee-partition query', async () => {
    const { handleRemap } = await import('./trustee-verification-remap');
    const surrogate = makeSurrogate();
    const nonSurrogate = makeSurrogate({ id: 'not-a-surrogate', isSurrogate: false });
    mockGetActiveByTrusteeIdFromTrusteePartition.mockResolvedValue([surrogate, nonSurrogate]);
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );

    await handleRemap(makeMessage(), makeInvocationContext());

    expect(mockUpsert).toHaveBeenCalledTimes(1);
    expect(mockDelete).toHaveBeenCalledTimes(1);
    expect(mockDelete).toHaveBeenCalledWith(surrogate.id);
  });

  test('soft-closes a different-trustee real appointment before upserting the canonical row', async () => {
    const { handleRemap } = await import('./trustee-verification-remap');
    const surrogate = makeSurrogate();
    const existingReal = {
      id: 'real-appt-1',
      caseId: surrogate.caseId,
      trusteeId: 'trustee-old',
      assignedOn: '2024-01-01T00:00:00.000Z',
    };
    mockGetActiveByTrusteeIdFromTrusteePartition.mockResolvedValue([surrogate]);
    mockGetActiveByCaseId.mockResolvedValue(existingReal);
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );

    await handleRemap(makeMessage(), makeInvocationContext());

    expect(mockUpdateCaseAppointment).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'real-appt-1', unassignedOn: expect.any(String) }),
    );
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ caseId: surrogate.caseId, trusteeId: 'trustee-new' }),
    );
    const softCloseOrder = mockUpdateCaseAppointment.mock.invocationCallOrder[0];
    const upsertOrder = mockUpsert.mock.invocationCallOrder[0];
    expect(softCloseOrder).toBeLessThan(upsertOrder);
  });

  test('skips soft-close and upsert when the existing real appointment is already the resolved trustee, but still deletes the surrogate', async () => {
    const { handleRemap } = await import('./trustee-verification-remap');
    const surrogate = makeSurrogate();
    mockGetActiveByTrusteeIdFromTrusteePartition.mockResolvedValue([surrogate]);
    mockGetActiveByCaseId.mockResolvedValue({
      id: 'real-appt-1',
      caseId: surrogate.caseId,
      trusteeId: 'trustee-new',
      assignedOn: '2024-01-01T00:00:00.000Z',
    });
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );

    await handleRemap(makeMessage(), makeInvocationContext());

    expect(mockUpdateCaseAppointment).not.toHaveBeenCalled();
    expect(mockUpsert).not.toHaveBeenCalled();
    expect(mockDelete).toHaveBeenCalledWith(surrogate.id);
  });

  test('a failed canonical upsert leaves the surrogate untouched and counts as a failure without aborting the batch', async () => {
    const { handleRemap } = await import('./trustee-verification-remap');
    const surrogateA = makeSurrogate({ id: 'surrogate-a', caseId: '081-25-00001' });
    const surrogateB = makeSurrogate({ id: 'surrogate-b', caseId: '081-25-00002' });
    mockGetActiveByTrusteeIdFromTrusteePartition.mockResolvedValue([surrogateA, surrogateB]);
    mockUpsert.mockRejectedValueOnce(new Error('upsert failed')).mockResolvedValue({});
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );
    const telemetrySpy = vi.spyOn(DataflowTelemetry, 'completeDataflowTrace');

    await handleRemap(makeMessage(), makeInvocationContext());

    expect(mockDelete).not.toHaveBeenCalledWith('surrogate-a');
    expect(mockDelete).toHaveBeenCalledWith('surrogate-b');
    expect(telemetrySpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'TRUSTEE-MATCH-VERIFICATION-REMAP',
      'handleRemap',
      expect.anything(),
      expect.objectContaining({ success: true, documentsWritten: 1, documentsFailed: 1 }),
    );
  });

  test('a rate-limit error mid-batch propagates to the outer retry handler instead of being counted as a per-case failure', async () => {
    const { handleRemap } = await import('./trustee-verification-remap');
    const surrogateA = makeSurrogate({ id: 'surrogate-a', caseId: '081-25-00001' });
    const surrogateB = makeSurrogate({ id: 'surrogate-b', caseId: '081-25-00002' });
    mockGetActiveByTrusteeIdFromTrusteePartition.mockResolvedValue([surrogateA, surrogateB]);
    const tooManyError = new TooManyRequestsError('TRUSTEE-MATCH-VERIFICATION-REMAP');
    mockUpsert.mockRejectedValueOnce(tooManyError).mockResolvedValue({});
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );

    const mockSendMessage = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(StorageQueueHumbleObject, 'fromConnectionString').mockReturnValue({
      sendMessage: mockSendMessage,
    } as unknown as StorageQueueHumbleObject);

    const telemetrySpy = vi.spyOn(DataflowTelemetry, 'completeDataflowTrace');

    await handleRemap(makeMessage({ retryCount: 0 }), makeInvocationContext());

    // The batch stops at the rate-limited case — surrogate-b is never attempted, and
    // surrogate-a's own failure is not counted as a per-case documentsFailed.
    expect(mockUpsert).toHaveBeenCalledTimes(1);
    expect(mockDelete).not.toHaveBeenCalled();
    expect(mockSendMessage).toHaveBeenCalled();
    expect(telemetrySpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'TRUSTEE-MATCH-VERIFICATION-REMAP',
      'handleRemap',
      expect.anything(),
      expect.objectContaining({ success: false, error: 'rate-limited-requeued' }),
    );
  });

  test('a failed surrogate delete after a successful upsert counts as a failure without aborting the batch (idempotent on retry)', async () => {
    const { handleRemap } = await import('./trustee-verification-remap');
    const surrogateA = makeSurrogate({ id: 'surrogate-a', caseId: '081-25-00001' });
    const surrogateB = makeSurrogate({ id: 'surrogate-b', caseId: '081-25-00002' });
    mockGetActiveByTrusteeIdFromTrusteePartition.mockResolvedValue([surrogateA, surrogateB]);
    mockDelete.mockImplementation((id: string) => {
      if (id === 'surrogate-a') return Promise.reject(new Error('delete failed'));
      return Promise.resolve(undefined);
    });
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );
    const telemetrySpy = vi.spyOn(DataflowTelemetry, 'completeDataflowTrace');

    await handleRemap(makeMessage(), makeInvocationContext());

    expect(mockUpsert).toHaveBeenCalledTimes(2);
    expect(telemetrySpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'TRUSTEE-MATCH-VERIFICATION-REMAP',
      'handleRemap',
      expect.anything(),
      expect.objectContaining({ success: true, documentsWritten: 1, documentsFailed: 1 }),
    );
  });

  test('queues a downstream event per remapped case when the feature flag is on', async () => {
    const { handleRemap } = await import('./trustee-verification-remap');
    const surrogate = makeSurrogate();
    mockGetActiveByTrusteeIdFromTrusteePartition.mockResolvedValue([surrogate]);
    const mockContext = await createMockApplicationContext();
    mockContext.featureFlags['downstream-trustee-appointments-enabled'] = true;
    vi.spyOn(factory, 'getOfficesGateway').mockReturnValue({
      getOffices: vi.fn().mockResolvedValue([]),
      getOfficeName: vi.fn(),
    });
    vi.spyOn(factory, 'getTrusteeProfessionalIdsRepository').mockReturnValue(
      Object.assign(new MockMongoRepository(), {
        findByCamsTrusteeId: vi.fn().mockResolvedValue([]),
      }),
    );
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);

    await handleRemap(makeMessage(), makeInvocationContext());

    expect(mockQueueTrusteeAppointmentEvent).toHaveBeenCalledWith(
      expect.objectContaining({ caseId: surrogate.caseId, trusteeId: 'trustee-new' }),
    );
  });

  test('does not queue a downstream event when the feature flag is off', async () => {
    const { handleRemap } = await import('./trustee-verification-remap');
    const surrogate = makeSurrogate();
    mockGetActiveByTrusteeIdFromTrusteePartition.mockResolvedValue([surrogate]);
    const mockContext = await createMockApplicationContext();
    mockContext.featureFlags['downstream-trustee-appointments-enabled'] = false;
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);

    await handleRemap(makeMessage(), makeInvocationContext());

    expect(mockQueueTrusteeAppointmentEvent).not.toHaveBeenCalled();
  });

  test('a batch with no remaining surrogates (already fully remapped) is a no-op success', async () => {
    const { handleRemap } = await import('./trustee-verification-remap');
    mockGetActiveByTrusteeIdFromTrusteePartition.mockResolvedValue([]);
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );
    const telemetrySpy = vi.spyOn(DataflowTelemetry, 'completeDataflowTrace');

    await handleRemap(makeMessage(), makeInvocationContext());

    expect(mockUpsert).not.toHaveBeenCalled();
    expect(mockDelete).not.toHaveBeenCalled();
    expect(telemetrySpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'TRUSTEE-MATCH-VERIFICATION-REMAP',
      'handleRemap',
      expect.anything(),
      expect.objectContaining({ success: true, documentsWritten: 0, documentsFailed: 0 }),
    );
  });

  test('should re-enqueue with backoff and emit rate-limited-requeued telemetry on 429 error', async () => {
    const { handleRemap } = await import('./trustee-verification-remap');
    const tooManyError = new TooManyRequestsError('TRUSTEE-MATCH-VERIFICATION-REMAP');
    mockGetActiveByTrusteeIdFromTrusteePartition.mockRejectedValue(tooManyError);
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );

    const mockSendMessage = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(StorageQueueHumbleObject, 'fromConnectionString').mockReturnValue({
      sendMessage: mockSendMessage,
    } as unknown as StorageQueueHumbleObject);

    const telemetrySpy = vi.spyOn(DataflowTelemetry, 'completeDataflowTrace');

    await handleRemap(makeMessage({ retryCount: 0 }), makeInvocationContext());

    expect(mockSendMessage).toHaveBeenCalled();
    expect(telemetrySpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'TRUSTEE-MATCH-VERIFICATION-REMAP',
      'handleRemap',
      expect.anything(),
      expect.objectContaining({ success: false, error: 'rate-limited-requeued' }),
    );
  });

  test('should route to DLQ and emit telemetry when retry limit exhausted', async () => {
    const { handleRemap } = await import('./trustee-verification-remap');
    const tooManyError = new TooManyRequestsError('TRUSTEE-MATCH-VERIFICATION-REMAP');
    mockGetActiveByTrusteeIdFromTrusteePartition.mockRejectedValue(tooManyError);
    const mockContext = await createMockApplicationContext();
    const extraOutputsSetSpy = vi.spyOn(mockContext.extraOutputs, 'set');
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);

    const telemetrySpy = vi.spyOn(DataflowTelemetry, 'completeDataflowTrace');

    await handleRemap(makeMessage({ retryCount: 10 }), makeInvocationContext());

    expect(extraOutputsSetSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queueName: expect.stringContaining('dlq') }),
      expect.anything(),
    );
    expect(telemetrySpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'TRUSTEE-MATCH-VERIFICATION-REMAP',
      'handleRemap',
      expect.anything(),
      expect.objectContaining({
        success: false,
        documentsFailed: 1,
        error: 'rate-limit-retry-exhausted',
      }),
    );
  });

  test('rethrows non-rate-limit errors', async () => {
    const { handleRemap } = await import('./trustee-verification-remap');
    mockGetActiveByTrusteeIdFromTrusteePartition.mockRejectedValue(new Error('boom'));
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );

    await expect(handleRemap(makeMessage(), makeInvocationContext())).rejects.toThrow('boom');
  });

  test('throws when AzureWebJobsDataflowsStorage is not configured', async () => {
    delete process.env.AzureWebJobsDataflowsStorage;
    const { handleRemap } = await import('./trustee-verification-remap');

    await expect(handleRemap(makeMessage(), makeInvocationContext())).rejects.toThrow(
      'Missing required environment variable: AzureWebJobsDataflowsStorage',
    );
  });
});
