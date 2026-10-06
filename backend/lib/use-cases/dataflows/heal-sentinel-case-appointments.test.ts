import { describe, test, expect, vi, beforeEach } from 'vitest';
import HealSentinelCaseAppointmentsUseCase from './heal-sentinel-case-appointments';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import factory from '../../factory';
import { TooManyRequestsError } from '../../common-errors/too-many-requests-error';
import { GatewayTimeoutError } from '../../common-errors/gateway-timeout';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import { ApplicationContext } from '../../adapters/types/basic';
import { CaseAppointment } from '@common/cams/trustee-appointments';
import { HealSentinelProfessionalId } from '@common/cams/dataflow-events';
import { TrusteeProfessionalIdSummary } from './trustee-professional-ids.types';
import { SENTINEL_TRUSTEE_ID } from './migrate-case-appointments-constants';

type SentinelAppointment = CaseAppointment & {
  _id: string;
  reason?: string;
  acmsProfessionalId?: string;
};

const PAGE_SIZE = 25;

const makeSentinel = (overrides: Partial<SentinelAppointment> = {}): SentinelAppointment =>
  ({
    id: `sentinel-${overrides.caseId ?? '001'}`,
    _id: 'appt-mongo-1',
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
  }) as SentinelAppointment;

const makeLink = (
  overrides: Partial<TrusteeProfessionalIdSummary & { _id: string }> = {},
): TrusteeProfessionalIdSummary & { _id: string } =>
  ({
    _id: 'prof-mongo-1',
    id: 'prof-id-1',
    documentType: 'TRUSTEE_PROFESSIONAL_ID',
    camsTrusteeId: 'trustee-resolved',
    acmsProfessionalId: 'NY-00063',
    disposition: 'linked',
    linkMethod: 'auto',
    nameMatchCount: 1,
    createdOn: '2025-01-01T00:00:00.000Z',
    updatedOn: '2025-01-01T00:00:00.000Z',
    ...overrides,
  }) as TrusteeProfessionalIdSummary & { _id: string };

const inProgress = (
  overrides: Partial<HealSentinelProfessionalId> = {},
): HealSentinelProfessionalId => ({
  professionalIdDocId: 'prof-mongo-1',
  camsTrusteeId: 'trustee-resolved',
  acmsProfessionalId: 'NY-00063',
  lastAppointmentId: 'appt-mongo-0',
  ...overrides,
});

describe('HealSentinelCaseAppointmentsUseCase', () => {
  let context: ApplicationContext;
  let useCase: HealSentinelCaseAppointmentsUseCase;
  let mockFindSentinels: ReturnType<typeof vi.fn>;
  let mockUpsert: ReturnType<typeof vi.fn>;
  let mockDeleteSentinel: ReturnType<typeof vi.fn>;
  let mockFindLinkedPending: ReturnType<typeof vi.fn>;
  let mockFindByAcmsProfessionalId: ReturnType<typeof vi.fn>;
  let mockMarkSentinelsHealed: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.restoreAllMocks();
    context = await createMockApplicationContext();

    mockFindSentinels = vi.fn().mockResolvedValue([]);
    mockUpsert = vi.fn().mockResolvedValue({});
    mockDeleteSentinel = vi.fn().mockResolvedValue(undefined);
    mockFindLinkedPending = vi.fn().mockResolvedValue([makeLink()]);
    mockFindByAcmsProfessionalId = vi.fn().mockResolvedValue([makeLink()]);
    mockMarkSentinelsHealed = vi.fn().mockResolvedValue(undefined);

    vi.spyOn(factory, 'getTrusteeCaseAppointmentsRepository').mockReturnValue(
      Object.assign(new MockMongoRepository(), {
        findSentinelAppointmentsByAcmsProfessionalId: mockFindSentinels,
        upsert: mockUpsert,
        deleteSentinel: mockDeleteSentinel,
      }),
    );
    vi.spyOn(factory, 'getTrusteeProfessionalIdsRepository').mockReturnValue(
      Object.assign(new MockMongoRepository(), {
        findLinkedPendingSentinelHeal: mockFindLinkedPending,
        findByAcmsProfessionalId: mockFindByAcmsProfessionalId,
        markSentinelsHealed: mockMarkSentinelsHealed,
      }),
    );

    useCase = new HealSentinelCaseAppointmentsUseCase(context);
  });

  test('heals a sentinel for the next pending linked ID: upserts under the linked trustee, then deletes the sentinel', async () => {
    const sentinel = makeSentinel();
    mockFindSentinels.mockResolvedValueOnce([sentinel]);

    const result = await useCase.healNext(
      { lastProfessionalIdDocId: null, current: null },
      PAGE_SIZE,
    );

    expect(mockFindLinkedPending).toHaveBeenCalledWith(null, 1);
    expect(mockFindSentinels).toHaveBeenNthCalledWith(1, 'NY-00063', null, PAGE_SIZE);
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
    const upserted = mockUpsert.mock.calls[0][0];
    expect(upserted).not.toHaveProperty('reason');
    expect(upserted).not.toHaveProperty('acmsProfessionalId');
    expect(upserted).not.toHaveProperty('_id');
    expect(upserted).not.toHaveProperty('id');
    expect(mockDeleteSentinel).toHaveBeenCalledWith(sentinel.caseId, sentinel.id);
    expect(mockUpsert.mock.invocationCallOrder[0]).toBeLessThan(
      mockDeleteSentinel.mock.invocationCallOrder[0],
    );
    expect(result).toMatchObject({ documentsWritten: 1, documentsFailed: 0, pageSize: 1 });
  });

  test('preserves unassignedOn, closedDate, and reopenedDate from a sentinel that represents an already-closed/reopened case', async () => {
    // upsert() is a full replaceOne with no merge, so dropping these would discard the case's
    // ACMS history and (since caseStatus derives from closedDate) misreport a closed case as OPEN.
    mockFindSentinels.mockResolvedValueOnce([
      makeSentinel({
        unassignedOn: '2025-03-01T00:00:00.000Z',
        closedDate: '2025-03-01',
        reopenedDate: '2025-04-01',
      }),
    ]);

    await useCase.healNext({ lastProfessionalIdDocId: null, current: null }, PAGE_SIZE);

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        unassignedOn: '2025-03-01T00:00:00.000Z',
        closedDate: '2025-03-01',
        reopenedDate: '2025-04-01',
      }),
    );
  });

  test('looks for the next pending linked ID after the last one finished', async () => {
    await useCase.healNext({ lastProfessionalIdDocId: 'prof-mongo-0', current: null }, PAGE_SIZE);

    expect(mockFindLinkedPending).toHaveBeenCalledWith('prof-mongo-0', 1);
  });

  test('ends the run when no linked ID is pending', async () => {
    mockFindLinkedPending.mockResolvedValue([]);

    const result = await useCase.healNext(
      { lastProfessionalIdDocId: 'prof-mongo-9', current: null },
      PAGE_SIZE,
    );

    expect(mockFindSentinels).not.toHaveBeenCalled();
    expect(result).toEqual({ documentsWritten: 0, documentsFailed: 0, pageSize: 0, next: null });
  });

  test('passes over an ACMS ID linked to more than one trustee without healing or flagging it', async () => {
    mockFindByAcmsProfessionalId.mockResolvedValue([
      makeLink({ camsTrusteeId: 'trustee-a' }),
      makeLink({ camsTrusteeId: 'trustee-b' }),
    ]);
    const warnSpy = vi.spyOn(context.logger, 'warn');

    const result = await useCase.healNext(
      { lastProfessionalIdDocId: null, current: null },
      PAGE_SIZE,
    );

    expect(mockFindSentinels).not.toHaveBeenCalled();
    expect(mockMarkSentinelsHealed).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(expect.any(String), expect.stringContaining('NY-00063'));
    expect(result.next).toEqual({ lastProfessionalIdDocId: 'prof-mongo-1', current: null });
  });

  test('a full page stays on the same ID with the appointment cursor advanced', async () => {
    const sentinels = Array.from({ length: PAGE_SIZE }, (_, i) =>
      makeSentinel({
        id: `sentinel-${i}`,
        _id: `appt-mongo-${String(i).padStart(2, '0')}`,
        caseId: `081-25-${String(i).padStart(5, '0')}`,
      }),
    );
    mockFindSentinels.mockResolvedValueOnce(sentinels);

    const result = await useCase.healNext(
      { lastProfessionalIdDocId: 'prof-mongo-0', current: inProgress() },
      PAGE_SIZE,
    );

    expect(mockUpsert).toHaveBeenCalledTimes(PAGE_SIZE);
    expect(mockMarkSentinelsHealed).not.toHaveBeenCalled();
    expect(result.next).toEqual({
      lastProfessionalIdDocId: 'prof-mongo-0',
      current: inProgress({ lastAppointmentId: `appt-mongo-${PAGE_SIZE - 1}` }),
    });
  });

  test('continues an in-progress ID from its appointment cursor without looking up the link again', async () => {
    await useCase.healNext(
      { lastProfessionalIdDocId: 'prof-mongo-0', current: inProgress() },
      PAGE_SIZE,
    );

    expect(mockFindLinkedPending).not.toHaveBeenCalled();
    expect(mockFindByAcmsProfessionalId).not.toHaveBeenCalled();
    expect(mockFindSentinels).toHaveBeenNthCalledWith(1, 'NY-00063', 'appt-mongo-0', PAGE_SIZE);
  });

  test('flags the ID healed and moves past it once no sentinels remain', async () => {
    mockFindSentinels.mockResolvedValueOnce([makeSentinel()]).mockResolvedValueOnce([]);

    const result = await useCase.healNext(
      { lastProfessionalIdDocId: 'prof-mongo-0', current: inProgress() },
      PAGE_SIZE,
    );

    expect(mockMarkSentinelsHealed).toHaveBeenCalledWith('trustee-resolved', 'NY-00063');
    expect(result.next).toEqual({ lastProfessionalIdDocId: 'prof-mongo-1', current: null });
  });

  test('a failed sentinel leaves the ID unflagged but still moves past it', async () => {
    const failed = makeSentinel({ id: 'sentinel-a', _id: 'appt-mongo-a', caseId: '081-25-00001' });
    const healed = makeSentinel({ id: 'sentinel-b', _id: 'appt-mongo-b', caseId: '081-25-00002' });
    mockFindSentinels.mockResolvedValueOnce([failed, healed]).mockResolvedValueOnce([failed]);
    mockUpsert.mockRejectedValueOnce(new Error('upsert failed')).mockResolvedValue({});
    const warnSpy = vi.spyOn(context.logger, 'warn');

    const result = await useCase.healNext(
      { lastProfessionalIdDocId: null, current: null },
      PAGE_SIZE,
    );

    expect(mockDeleteSentinel).toHaveBeenCalledTimes(1);
    expect(mockDeleteSentinel).toHaveBeenCalledWith(healed.caseId, healed.id);
    expect(mockMarkSentinelsHealed).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(expect.any(String), expect.stringContaining('NY-00063'));
    expect(result).toMatchObject({
      documentsWritten: 1,
      documentsFailed: 1,
      next: { lastProfessionalIdDocId: 'prof-mongo-1', current: null },
    });
  });

  test('a rate-limit error mid-page rethrows instead of being counted as a per-record failure', async () => {
    mockFindSentinels.mockResolvedValueOnce([
      makeSentinel({ id: 'sentinel-a', caseId: '081-25-00001' }),
      makeSentinel({ id: 'sentinel-b', caseId: '081-25-00002' }),
    ]);
    const tooManyError = new TooManyRequestsError('HEAL-SENTINEL-CASE-APPOINTMENTS-USE-CASE');
    mockUpsert.mockRejectedValueOnce(tooManyError);

    await expect(
      useCase.healNext({ lastProfessionalIdDocId: null, current: null }, PAGE_SIZE),
    ).rejects.toThrow(tooManyError);
    expect(mockUpsert).toHaveBeenCalledTimes(1);
    expect(mockDeleteSentinel).not.toHaveBeenCalled();
  });

  test('a gateway-timeout error mid-page rethrows instead of being counted as a per-record failure', async () => {
    mockFindSentinels.mockResolvedValueOnce([
      makeSentinel({ id: 'sentinel-a', caseId: '081-25-00001' }),
      makeSentinel({ id: 'sentinel-b', caseId: '081-25-00002' }),
    ]);
    const timeoutError = new GatewayTimeoutError('TRUSTEE-CASE-APPOINTMENTS-MONGO-REPOSITORY', {
      message: 'Query failed. Search request timed out.',
    });
    mockDeleteSentinel.mockRejectedValueOnce(timeoutError);

    await expect(
      useCase.healNext({ lastProfessionalIdDocId: null, current: null }, PAGE_SIZE),
    ).rejects.toThrow(timeoutError);
    expect(mockDeleteSentinel).toHaveBeenCalledTimes(1);
  });
});
