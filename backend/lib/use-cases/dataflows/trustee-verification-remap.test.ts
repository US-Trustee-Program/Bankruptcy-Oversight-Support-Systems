import { describe, test, expect, vi, beforeEach, Mock } from 'vitest';
import TrusteeVerificationRemapUseCase from './trustee-verification-remap';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import factory from '../../factory';
import { TooManyRequestsError } from '../../common-errors/too-many-requests-error';
import { GatewayTimeoutError } from '../../common-errors/gateway-timeout';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import { ApplicationContext } from '../../adapters/types/basic';
import { CaseAppointment } from '@common/cams/trustee-appointments';
import {
  TrusteeAppointmentDownstreamEvent,
  TrusteeVerificationRemapMessage,
} from '@common/cams/dataflow-events';

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

describe('TrusteeVerificationRemapUseCase', () => {
  let context: ApplicationContext;
  let useCase: TrusteeVerificationRemapUseCase;
  let mockGetSurrogatesByFingerprint: ReturnType<typeof vi.fn>;
  let mockGetActiveByCaseId: ReturnType<typeof vi.fn>;
  let mockUpdateCaseAppointment: ReturnType<typeof vi.fn>;
  let mockUpsert: ReturnType<typeof vi.fn>;
  let mockDelete: ReturnType<typeof vi.fn>;
  let mockQueueTrusteeAppointmentEvent: Mock<
    (event: TrusteeAppointmentDownstreamEvent) => Promise<void>
  >;

  beforeEach(async () => {
    vi.restoreAllMocks();
    context = await createMockApplicationContext();

    mockGetSurrogatesByFingerprint = vi.fn().mockResolvedValue([]);
    mockGetActiveByCaseId = vi.fn().mockResolvedValue(null);
    mockUpdateCaseAppointment = vi.fn().mockResolvedValue({});
    mockUpsert = vi.fn().mockResolvedValue({});
    mockDelete = vi.fn().mockResolvedValue(undefined);
    mockQueueTrusteeAppointmentEvent = vi.fn().mockResolvedValue(undefined);

    vi.spyOn(factory, 'getTrusteeCaseAppointmentsRepository').mockReturnValue(
      Object.assign(new MockMongoRepository(), {
        getSurrogatesByFingerprint: mockGetSurrogatesByFingerprint,
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

    useCase = new TrusteeVerificationRemapUseCase(context);
  });

  test('remaps a single surrogate case: upserts canonical appointment then deletes surrogate', async () => {
    const surrogate = makeSurrogate();
    mockGetSurrogatesByFingerprint.mockResolvedValue([surrogate]);

    const result = await useCase.remapPage(makeMessage(), 25);

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
    expect(mockDelete).toHaveBeenCalledWith(surrogate.id);
    const upsertOrder = mockUpsert.mock.invocationCallOrder[0];
    const deleteOrder = mockDelete.mock.invocationCallOrder[0];
    expect(upsertOrder).toBeLessThan(deleteOrder);
    expect(result).toEqual({
      documentsWritten: 1,
      documentsFailed: 0,
      downstreamNotificationFailedCount: 0,
      totalCandidates: 1,
      pageSize: 1,
      remainingCount: 0,
    });
  });

  test('soft-closes a different-trustee real appointment before upserting the canonical row', async () => {
    const surrogate = makeSurrogate();
    const existingReal = {
      id: 'real-appt-1',
      caseId: surrogate.caseId,
      trusteeId: 'trustee-old',
      assignedOn: '2024-01-01T00:00:00.000Z',
    };
    mockGetSurrogatesByFingerprint.mockResolvedValue([surrogate]);
    mockGetActiveByCaseId.mockResolvedValue(existingReal);

    await useCase.remapPage(makeMessage(), 25);

    expect(mockUpdateCaseAppointment).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'real-appt-1', unassignedOn: expect.any(String) }),
    );
    const softCloseOrder = mockUpdateCaseAppointment.mock.invocationCallOrder[0];
    const upsertOrder = mockUpsert.mock.invocationCallOrder[0];
    expect(softCloseOrder).toBeLessThan(upsertOrder);
  });

  test('skips soft-close and upsert when the existing real appointment is already the resolved trustee, but still deletes the surrogate', async () => {
    const surrogate = makeSurrogate();
    mockGetSurrogatesByFingerprint.mockResolvedValue([surrogate]);
    mockGetActiveByCaseId.mockResolvedValue({
      id: 'real-appt-1',
      caseId: surrogate.caseId,
      trusteeId: 'trustee-new',
      assignedOn: '2024-01-01T00:00:00.000Z',
    });

    await useCase.remapPage(makeMessage(), 25);

    expect(mockUpdateCaseAppointment).not.toHaveBeenCalled();
    expect(mockUpsert).not.toHaveBeenCalled();
    expect(mockDelete).toHaveBeenCalledWith(surrogate.id);
  });

  test('a failed canonical upsert leaves the surrogate untouched and counts as a failure without aborting the page', async () => {
    const surrogateA = makeSurrogate({ id: 'surrogate-a', caseId: '081-25-00001' });
    const surrogateB = makeSurrogate({ id: 'surrogate-b', caseId: '081-25-00002' });
    mockGetSurrogatesByFingerprint.mockResolvedValue([surrogateA, surrogateB]);
    mockUpsert.mockRejectedValueOnce(new Error('upsert failed')).mockResolvedValue({});

    const result = await useCase.remapPage(makeMessage(), 25);

    expect(mockDelete).not.toHaveBeenCalledWith('surrogate-a');
    expect(mockDelete).toHaveBeenCalledWith('surrogate-b');
    expect(result.documentsWritten).toBe(1);
    expect(result.documentsFailed).toBe(1);
  });

  test('a rate-limit error mid-page rethrows instead of being counted as a per-case failure', async () => {
    const surrogateA = makeSurrogate({ id: 'surrogate-a', caseId: '081-25-00001' });
    const surrogateB = makeSurrogate({ id: 'surrogate-b', caseId: '081-25-00002' });
    mockGetSurrogatesByFingerprint.mockResolvedValue([surrogateA, surrogateB]);
    const tooManyError = new TooManyRequestsError('TRUSTEE-VERIFICATION-REMAP-USE-CASE');
    mockUpsert.mockRejectedValueOnce(tooManyError).mockResolvedValue({});

    await expect(useCase.remapPage(makeMessage(), 25)).rejects.toThrow(tooManyError);
    expect(mockUpsert).toHaveBeenCalledTimes(1);
    expect(mockDelete).not.toHaveBeenCalled();
  });

  test('a gateway-timeout error mid-page rethrows instead of being counted as a per-case failure', async () => {
    // CAMS-809: a Cosmos deleteOne timeout (surfaced as a GatewayTimeoutError, HTTP 504) was
    // previously swallowed as a permanent per-case failure here, never reaching handleRemap's
    // outer handleRateLimitRetry — which already treats isTooManyRequestsError and
    // isGatewayTimeoutError as the same retriable batch-level signal (see
    // dataflows-rate-limit.ts). Must rethrow the same way a rate-limit error does.
    const surrogateA = makeSurrogate({ id: 'surrogate-a', caseId: '081-25-00001' });
    const surrogateB = makeSurrogate({ id: 'surrogate-b', caseId: '081-25-00002' });
    mockGetSurrogatesByFingerprint.mockResolvedValue([surrogateA, surrogateB]);
    const timeoutError = new GatewayTimeoutError(
      'TRUSTEE-CASE-APPOINTMENTS-MONGO-REPOSITORY_ADAPTER',
      {
        message: 'Query failed. Search request timed out.',
      },
    );
    mockDelete.mockRejectedValueOnce(timeoutError).mockResolvedValue(undefined);

    await expect(useCase.remapPage(makeMessage(), 25)).rejects.toThrow(timeoutError);
    expect(mockDelete).toHaveBeenCalledTimes(1);
  });

  test('queues a downstream event per remapped case when the feature flag is on', async () => {
    const surrogate = makeSurrogate();
    mockGetSurrogatesByFingerprint.mockResolvedValue([surrogate]);
    context.featureFlags['downstream-trustee-appointments-enabled'] = true;
    vi.spyOn(factory, 'getOfficesGateway').mockReturnValue({
      getOffices: vi.fn().mockResolvedValue([]),
      getOfficeName: vi.fn(),
    });
    vi.spyOn(factory, 'getTrusteeProfessionalIdsRepository').mockReturnValue(
      Object.assign(new MockMongoRepository(), {
        findByCamsTrusteeId: vi.fn().mockResolvedValue([]),
      }),
    );
    useCase = new TrusteeVerificationRemapUseCase(context);

    await useCase.remapPage(makeMessage(), 25);

    expect(mockQueueTrusteeAppointmentEvent).toHaveBeenCalledWith(
      expect.objectContaining({ caseId: surrogate.caseId, trusteeId: 'trustee-new' }),
    );
  });

  test('does not queue a downstream event when the feature flag is off', async () => {
    const surrogate = makeSurrogate();
    mockGetSurrogatesByFingerprint.mockResolvedValue([surrogate]);
    context.featureFlags['downstream-trustee-appointments-enabled'] = false;
    useCase = new TrusteeVerificationRemapUseCase(context);

    await useCase.remapPage(makeMessage(), 25);

    expect(mockQueueTrusteeAppointmentEvent).not.toHaveBeenCalled();
  });

  test('counts a failed downstream notification separately without treating the remap as failed', async () => {
    const surrogate = makeSurrogate();
    mockGetSurrogatesByFingerprint.mockResolvedValue([surrogate]);
    context.featureFlags['downstream-trustee-appointments-enabled'] = true;
    vi.spyOn(factory, 'getOfficesGateway').mockReturnValue({
      getOffices: vi.fn().mockResolvedValue([]),
      getOfficeName: vi.fn(),
    });
    vi.spyOn(factory, 'getTrusteeProfessionalIdsRepository').mockReturnValue(
      Object.assign(new MockMongoRepository(), {
        findByCamsTrusteeId: vi.fn().mockResolvedValue([]),
      }),
    );
    mockQueueTrusteeAppointmentEvent.mockRejectedValueOnce(new Error('queue unavailable'));
    useCase = new TrusteeVerificationRemapUseCase(context);

    const result = await useCase.remapPage(makeMessage(), 25);

    // The Cosmos remap (upsert + delete) still happened -- only the downstream notification failed.
    expect(mockUpsert).toHaveBeenCalledTimes(1);
    expect(mockDelete).toHaveBeenCalledTimes(1);
    expect(result.documentsWritten).toBe(1);
    expect(result.documentsFailed).toBe(0);
    expect(result.downstreamNotificationFailedCount).toBe(1);
  });

  test('reports a positive remainingCount when surrogates exceed the requested page size', async () => {
    const surrogates = Array.from({ length: 30 }, (_, i) =>
      makeSurrogate({ id: `surrogate-${i}`, caseId: `081-25-${String(i).padStart(5, '0')}` }),
    );
    mockGetSurrogatesByFingerprint.mockResolvedValue(surrogates);

    const result = await useCase.remapPage(makeMessage(), 25);

    expect(mockUpsert).toHaveBeenCalledTimes(25);
    expect(result).toMatchObject({
      documentsWritten: 25,
      totalCandidates: 30,
      pageSize: 25,
      remainingCount: 5,
    });
  });

  test('a no-op page (no surrogates left) returns all zeros', async () => {
    mockGetSurrogatesByFingerprint.mockResolvedValue([]);

    const result = await useCase.remapPage(makeMessage(), 25);

    expect(mockUpsert).not.toHaveBeenCalled();
    expect(mockDelete).not.toHaveBeenCalled();
    expect(result).toEqual({
      documentsWritten: 0,
      documentsFailed: 0,
      downstreamNotificationFailedCount: 0,
      totalCandidates: 0,
      pageSize: 0,
      remainingCount: 0,
    });
  });
});
