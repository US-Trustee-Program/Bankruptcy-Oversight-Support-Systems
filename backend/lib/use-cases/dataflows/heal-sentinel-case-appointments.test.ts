import { describe, test, expect, vi, beforeEach } from 'vitest';
import HealSentinelCaseAppointmentsUseCase from './heal-sentinel-case-appointments';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import factory from '../../factory';
import { TooManyRequestsError } from '../../common-errors/too-many-requests-error';
import { GatewayTimeoutError } from '../../common-errors/gateway-timeout';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import { ApplicationContext } from '../../adapters/types/basic';
import { CaseAppointment } from '@common/cams/trustee-appointments';
import { TrusteeProfessionalId } from '@common/cams/trustee-professional-ids';
import { SENTINEL_TRUSTEE_ID } from './migrate-case-appointments-constants';

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

describe('HealSentinelCaseAppointmentsUseCase', () => {
  let context: ApplicationContext;
  let useCase: HealSentinelCaseAppointmentsUseCase;
  let mockFindSentinelAppointments: ReturnType<typeof vi.fn>;
  let mockFindByAcmsProfessionalId: ReturnType<typeof vi.fn>;
  let mockUpsert: ReturnType<typeof vi.fn>;
  let mockDelete: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.restoreAllMocks();
    context = await createMockApplicationContext();

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

    useCase = new HealSentinelCaseAppointmentsUseCase(context);
  });

  test('heals a matched sentinel: upserts the resolved appointment then deletes the sentinel', async () => {
    const sentinel = makeSentinel();
    mockFindSentinelAppointments.mockResolvedValue([sentinel]);
    mockFindByAcmsProfessionalId.mockResolvedValue([makeProfessionalId()]);

    const result = await useCase.healPage(25);

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        caseId: sentinel.caseId,
        trusteeId: 'trustee-resolved',
        assignedOn: sentinel.assignedOn,
        appointedDate: sentinel.appointedDate,
        dateFiled: sentinel.dateFiled,
        chapter: sentinel.chapter,
        courtDivisionCode: sentinel.courtDivisionCode,
      }),
    );
    expect(mockUpsert.mock.calls[0][0]).not.toHaveProperty('reason');
    expect(mockDelete).toHaveBeenCalledWith(sentinel.id);
    const upsertOrder = mockUpsert.mock.invocationCallOrder[0];
    const deleteOrder = mockDelete.mock.invocationCallOrder[0];
    expect(upsertOrder).toBeLessThan(deleteOrder);
    expect(result).toEqual({
      documentsWritten: 1,
      documentsFailed: 0,
      pageSize: 1,
      remainingCount: 1,
    });
  });

  test('upsert is idempotent: healing an already-healed case (matching natural key) does not error', async () => {
    // upsert()'s natural-key replace makes re-healing safe even if a non-sentinel appointment
    // already exists for this case under the resolved trustee — no separate skip-write branch
    // is needed (collapsed per design decision).
    const sentinel = makeSentinel();
    mockFindSentinelAppointments.mockResolvedValue([sentinel]);
    mockFindByAcmsProfessionalId.mockResolvedValue([makeProfessionalId()]);

    await useCase.healPage(25);

    expect(mockUpsert).toHaveBeenCalledTimes(1);
    expect(mockDelete).toHaveBeenCalledTimes(1);
  });

  test('no match: leaves the sentinel in place and does not upsert or delete', async () => {
    const sentinel = makeSentinel();
    mockFindSentinelAppointments.mockResolvedValue([sentinel]);
    mockFindByAcmsProfessionalId.mockResolvedValue([]);

    const result = await useCase.healPage(25);

    expect(mockUpsert).not.toHaveBeenCalled();
    expect(mockDelete).not.toHaveBeenCalled();
    expect(result).toEqual({
      documentsWritten: 0,
      documentsFailed: 0,
      pageSize: 1,
      remainingCount: 1,
    });
  });

  test('a failed upsert leaves the sentinel untouched and counts as a failure without aborting the page', async () => {
    const sentinelA = makeSentinel({ id: 'sentinel-a', caseId: '081-25-00001' });
    const sentinelB = makeSentinel({ id: 'sentinel-b', caseId: '081-25-00002' });
    mockFindSentinelAppointments.mockResolvedValue([sentinelA, sentinelB]);
    mockFindByAcmsProfessionalId.mockResolvedValue([makeProfessionalId()]);
    mockUpsert.mockRejectedValueOnce(new Error('upsert failed')).mockResolvedValue({});

    const result = await useCase.healPage(25);

    expect(mockDelete).not.toHaveBeenCalledWith('sentinel-a');
    expect(mockDelete).toHaveBeenCalledWith('sentinel-b');
    expect(result.documentsWritten).toBe(1);
    expect(result.documentsFailed).toBe(1);
  });

  test('a rate-limit error mid-page rethrows instead of being counted as a per-record failure', async () => {
    const sentinelA = makeSentinel({ id: 'sentinel-a', caseId: '081-25-00001' });
    const sentinelB = makeSentinel({ id: 'sentinel-b', caseId: '081-25-00002' });
    mockFindSentinelAppointments.mockResolvedValue([sentinelA, sentinelB]);
    mockFindByAcmsProfessionalId.mockResolvedValue([makeProfessionalId()]);
    const tooManyError = new TooManyRequestsError('HEAL-SENTINEL-CASE-APPOINTMENTS-USE-CASE');
    mockUpsert.mockRejectedValueOnce(tooManyError).mockResolvedValue({});

    await expect(useCase.healPage(25)).rejects.toThrow(tooManyError);
    expect(mockUpsert).toHaveBeenCalledTimes(1);
    expect(mockDelete).not.toHaveBeenCalled();
  });

  test('a gateway-timeout error mid-page rethrows instead of being counted as a per-record failure', async () => {
    const sentinelA = makeSentinel({ id: 'sentinel-a', caseId: '081-25-00001' });
    const sentinelB = makeSentinel({ id: 'sentinel-b', caseId: '081-25-00002' });
    mockFindSentinelAppointments.mockResolvedValue([sentinelA, sentinelB]);
    mockFindByAcmsProfessionalId.mockResolvedValue([makeProfessionalId()]);
    const timeoutError = new GatewayTimeoutError('TRUSTEE-CASE-APPOINTMENTS-MONGO-REPOSITORY', {
      message: 'Query failed. Search request timed out.',
    });
    mockDelete.mockRejectedValueOnce(timeoutError).mockResolvedValue(undefined);

    await expect(useCase.healPage(25)).rejects.toThrow(timeoutError);
    expect(mockDelete).toHaveBeenCalledTimes(1);
  });

  test('reports remainingCount > 0 when a full page is returned (more may remain)', async () => {
    const sentinels = Array.from({ length: 25 }, (_, i) =>
      makeSentinel({ id: `sentinel-${i}`, caseId: `081-25-${String(i).padStart(5, '0')}` }),
    );
    mockFindSentinelAppointments.mockResolvedValue(sentinels);
    mockFindByAcmsProfessionalId.mockResolvedValue([makeProfessionalId()]);

    const result = await useCase.healPage(25);

    expect(mockUpsert).toHaveBeenCalledTimes(25);
    expect(result).toMatchObject({
      documentsWritten: 25,
      pageSize: 25,
      remainingCount: 25,
    });
  });

  test('an empty page (no sentinels left) returns all zeros and remainingCount 0', async () => {
    mockFindSentinelAppointments.mockResolvedValue([]);

    const result = await useCase.healPage(25);

    expect(mockFindByAcmsProfessionalId).not.toHaveBeenCalled();
    expect(mockUpsert).not.toHaveBeenCalled();
    expect(mockDelete).not.toHaveBeenCalled();
    expect(result).toEqual({
      documentsWritten: 0,
      documentsFailed: 0,
      pageSize: 0,
      remainingCount: 0,
    });
  });

  test('queries findSentinelAppointments with the requested page size', async () => {
    await useCase.healPage(25);

    expect(mockFindSentinelAppointments).toHaveBeenCalledWith(25);
  });
});
