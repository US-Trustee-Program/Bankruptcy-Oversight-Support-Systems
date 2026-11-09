import { describe, test, expect, vi, beforeEach } from 'vitest';
import TrusteeVerificationRemapUseCase from './trustee-verification-remap';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import factory from '../../factory';
import { TooManyRequestsError } from '../../common-errors/too-many-requests-error';
import { GatewayTimeoutError } from '../../common-errors/gateway-timeout';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import { ApplicationContext } from '../../adapters/types/basic';
import { CaseAppointment } from '@common/cams/trustee-appointments';
import { TrusteeVerificationRemapMessage } from '@common/cams/dataflow-events';
import CaseManagement from '../cases/case-management';
import { CaseSummary } from '@common/cams/cases';

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
  let mockGetTrusteeAppointments: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.restoreAllMocks();
    context = await createMockApplicationContext();

    mockGetSurrogatesByFingerprint = vi.fn().mockResolvedValue([]);
    mockGetActiveByCaseId = vi.fn().mockResolvedValue(null);
    mockUpdateCaseAppointment = vi.fn().mockResolvedValue({});
    mockUpsert = vi.fn().mockResolvedValue({});
    mockDelete = vi.fn().mockResolvedValue(undefined);
    // Matches makeSurrogate's defaults (courtDivisionCode/chapter '081'/'7') so every
    // pre-existing test -- which doesn't care about the division re-validation guard --
    // continues to pass it by default. Tests exercising the guard itself override this.
    mockGetTrusteeAppointments = vi
      .fn()
      .mockResolvedValue([
        { status: 'active', courtId: '081', chapter: '7', divisionCodes: ['081'] },
      ]);

    vi.spyOn(factory, 'getTrusteeCaseAppointmentsRepository').mockReturnValue(
      Object.assign(new MockMongoRepository(), {
        getSurrogatesByFingerprint: mockGetSurrogatesByFingerprint,
        getActiveByCaseId: mockGetActiveByCaseId,
        updateCaseAppointment: mockUpdateCaseAppointment,
        upsert: mockUpsert,
        delete: mockDelete,
      }),
    );
    vi.spyOn(factory, 'getTrusteeAppointmentsRepository').mockReturnValue(
      Object.assign(new MockMongoRepository(), {
        getTrusteeAppointments: mockGetTrusteeAppointments,
      }),
    );
    vi.spyOn(CaseManagement.prototype, 'getCaseSummary').mockImplementation(
      async (_context, caseId) =>
        ({ caseId, courtId: '081', courtDivisionCode: '081', chapter: '7' }) as CaseSummary,
    );

    useCase = new TrusteeVerificationRemapUseCase(context);
  });

  test('carries a disposed surrogate unassignedOn onto the canonical appointment', async () => {
    const surrogate = makeSurrogate({ unassignedOn: '2025-03-01' });
    mockGetSurrogatesByFingerprint.mockResolvedValue([surrogate]);

    await useCase.remapPage(makeMessage(), 25);

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ trusteeId: 'trustee-new', unassignedOn: '2025-03-01' }),
    );
    expect(mockDelete).toHaveBeenCalledWith(surrogate.id);
  });

  test('a disposed surrogate is written closed and leaves a superseding active appointment untouched', async () => {
    // makeSurrogate's assignedOn is 2025-01-01; the active appointment was assigned later, so it
    // supersedes the surrogate. A disposed surrogate is history and must not close it.
    const surrogate = makeSurrogate({ unassignedOn: '2025-03-01' });
    const superseding = {
      id: 'real-superseding',
      caseId: surrogate.caseId,
      trusteeId: 'trustee-superseding',
      assignedOn: '2025-06-01T00:00:00.000Z',
    } as CaseAppointment;
    mockGetSurrogatesByFingerprint.mockResolvedValue([surrogate]);
    mockGetActiveByCaseId.mockResolvedValue(superseding);

    await useCase.remapPage(makeMessage(), 25);

    expect(mockUpdateCaseAppointment).not.toHaveBeenCalled();
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        trusteeId: 'trustee-new',
        assignedOn: surrogate.assignedOn,
        unassignedOn: '2025-03-01',
      }),
    );
  });

  test('an open surrogate superseded by a later active appointment is written closed the day before it, leaving that appointment untouched', async () => {
    // In-order case: an unresolved trustee appointed 2026-01-01 (open placeholder), then trustee B
    // appointed 2026-03-01 becomes the active appointment. Approving the placeholder as X must not
    // end B; X's copy closes the day before B starts.
    const surrogate = makeSurrogate({ assignedOn: '2026-01-01', appointedDate: '2026-01-01' });
    const superseding = {
      id: 'real-b',
      caseId: surrogate.caseId,
      trusteeId: 'trustee-b',
      assignedOn: '2026-03-01',
    } as CaseAppointment;
    mockGetSurrogatesByFingerprint.mockResolvedValue([surrogate]);
    mockGetActiveByCaseId.mockResolvedValue(superseding);

    await useCase.remapPage(makeMessage(), 25);

    expect(mockUpdateCaseAppointment).not.toHaveBeenCalled();
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        trusteeId: 'trustee-new',
        assignedOn: '2026-01-01',
        unassignedOn: '2026-02-28',
      }),
    );
  });

  test('an open surrogate closes a same-day different-trustee appointment at its own start date (zero-length, the derived clamp)', async () => {
    // Same-age is not superseding: the boundary is strictly later, so this row is closed. The day
    // before the surrogate would precede the row's start, so deriveUnassignedOn clamps the close to
    // that start date.
    const surrogate = makeSurrogate({ assignedOn: '2026-01-01', appointedDate: '2026-01-01' });
    const sameAge = {
      id: 'real-same-age',
      caseId: surrogate.caseId,
      trusteeId: 'trustee-same-age',
      assignedOn: '2026-01-01',
    } as CaseAppointment;
    mockGetSurrogatesByFingerprint.mockResolvedValue([surrogate]);
    mockGetActiveByCaseId.mockResolvedValue(sameAge);

    await useCase.remapPage(makeMessage(), 25);

    expect(mockUpdateCaseAppointment).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'real-same-age', unassignedOn: '2026-01-01' }),
    );
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
      permanentFailureCount: 0,
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
      expect.objectContaining({ id: 'real-appt-1', unassignedOn: '2024-12-31' }),
    );
    const softCloseOrder = mockUpdateCaseAppointment.mock.invocationCallOrder[0];
    const upsertOrder = mockUpsert.mock.invocationCallOrder[0];
    expect(softCloseOrder).toBeLessThan(upsertOrder);
  });

  test('re-processing a copy already recorded for the resolved trustee closes nothing, re-upserts the same key, and still deletes the surrogate', async () => {
    const surrogate = makeSurrogate();
    mockGetSurrogatesByFingerprint.mockResolvedValue([surrogate]);
    mockGetActiveByCaseId.mockResolvedValue({
      id: 'real-appt-1',
      caseId: surrogate.caseId,
      trusteeId: 'trustee-new',
      assignedOn: '2025-01-01T00:00:00.000Z',
    });

    await useCase.remapPage(makeMessage(), 25);

    expect(mockUpdateCaseAppointment).not.toHaveBeenCalled();
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        caseId: surrogate.caseId,
        trusteeId: 'trustee-new',
        assignedOn: surrogate.assignedOn,
      }),
    );
    expect(mockDelete).toHaveBeenCalledWith(surrogate.id);
  });

  test('two court appointments for one fingerprint are both recorded for the resolved trustee, the older closed by latest-wins', async () => {
    const older = makeSurrogate({
      id: 'surrogate-older',
      assignedOn: '2026-01-01',
      appointedDate: '2026-01-01',
    });
    const newer = makeSurrogate({
      id: 'surrogate-newer',
      assignedOn: '2026-03-01',
      appointedDate: '2026-03-01',
    });
    mockGetSurrogatesByFingerprint.mockResolvedValue([older, newer]);
    // Remapping the older copy finds no active appointment; the newer copy then finds the older
    // copy just written for the same trustee.
    mockGetActiveByCaseId.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: 'written-older',
      caseId: older.caseId,
      trusteeId: 'trustee-new',
      assignedOn: '2026-01-01',
    });

    await useCase.remapPage(makeMessage(), 25);

    expect(mockUpdateCaseAppointment).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'written-older', unassignedOn: '2026-02-28' }),
    );
    expect(mockUpsert).toHaveBeenCalledTimes(2);
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ trusteeId: 'trustee-new', assignedOn: '2026-01-01' }),
    );
    expect(mockUpsert).toHaveBeenLastCalledWith(
      expect.objectContaining({ trusteeId: 'trustee-new', assignedOn: '2026-03-01' }),
    );
    expect(mockUpsert.mock.calls[1][0]).not.toHaveProperty('unassignedOn');
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
      permanentFailureCount: 0,
      totalCandidates: 0,
      pageSize: 0,
      remainingCount: 0,
    });
  });

  test('skips remapping a surrogate whose fresh case summary no longer matches the resolved trustee division -- defense in depth against the approval race window', async () => {
    // A surrogate could be admitted into this fingerprint's bucket after
    // approveVerification's own division-check snapshot but before its TRUSTEE_VARIATION
    // write closes the window (see that use case's step 2-4 comments) -- such a surrogate
    // would never have passed any division check at all. This re-validates against a fresh
    // case summary rather than trusting the surrogate's own stale courtDivisionCode/chapter.
    const surrogate = makeSurrogate({ courtDivisionCode: '099', chapter: '13' });
    mockGetSurrogatesByFingerprint.mockResolvedValue([surrogate]);
    vi.spyOn(CaseManagement.prototype, 'getCaseSummary').mockResolvedValue({
      caseId: surrogate.caseId,
      courtId: '099',
      courtDivisionCode: '099',
      chapter: '13',
    } as CaseSummary);
    // Resolved trustee is only assigned to '081'/'7' (the default appointment), not '099'/'13'.

    const result = await useCase.remapPage(makeMessage(), 25);

    expect(mockUpsert).not.toHaveBeenCalled();
    expect(mockDelete).not.toHaveBeenCalled();
    expect(result.documentsWritten).toBe(0);
    // A genuine division mismatch is permanent -- retrying this surrogate can never succeed,
    // so it's tracked separately from documentsFailed (which represents failures that might).
    expect(result.documentsFailed).toBe(0);
    expect(result.permanentFailureCount).toBe(1);
  });

  test('persists the freshly-fetched division/chapter, not the stale surrogate ones, when the case was transferred before remap', async () => {
    // Matt Stankey's PR #3090 finding: the guard above re-fetches and validates against a
    // FRESH case summary, but then persisted the SURROGATE's stale courtDivisionCode/chapter
    // anyway -- so a case transferred to a still-covered division between surrogate creation
    // and remap would pass the fresh-data check and then write the pre-transfer division right
    // back to storage, the exact staleness the check exists to catch.
    const surrogate = makeSurrogate({ courtDivisionCode: '081', chapter: '7' });
    mockGetSurrogatesByFingerprint.mockResolvedValue([surrogate]);
    // Case transferred to division '082' since the surrogate was created; trustee covers both.
    vi.spyOn(CaseManagement.prototype, 'getCaseSummary').mockResolvedValue({
      caseId: surrogate.caseId,
      courtId: '081',
      courtDivisionCode: '082',
      chapter: '7',
    } as CaseSummary);
    mockGetTrusteeAppointments.mockResolvedValue([
      { status: 'active', courtId: '081', chapter: '7', divisionCodes: ['081', '082'] },
    ]);

    const result = await useCase.remapPage(makeMessage(), 25);

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ courtDivisionCode: '082', chapter: '7' }),
    );
    expect(result.documentsWritten).toBe(1);
  });

  test('counts a documentsFailed when the fresh case summary carries a malformed chapter, even though it passed the division/chapter match', async () => {
    // isAppointmentMatch's normalizeChapter is deliberately LOOSE for matching purposes --
    // it extracts leading digits, so a dirty DXTR value like '11X' normalizes to '11' and
    // matches an active chapter-11 appointment -- but assertValidChapter's storage guard is
    // STRICT (exact membership in VALID_CASE_CHAPTERS), so '11X' itself is rejected. A case
    // can therefore pass the match check above and still fail validation here; this is a real,
    // reachable failure mode, not dead defensive code.
    const surrogate = makeSurrogate({ courtDivisionCode: '081', chapter: '7' });
    mockGetSurrogatesByFingerprint.mockResolvedValue([surrogate]);
    vi.spyOn(CaseManagement.prototype, 'getCaseSummary').mockResolvedValue({
      caseId: surrogate.caseId,
      courtId: '081',
      courtDivisionCode: '081',
      chapter: '11X',
    } as CaseSummary);
    mockGetTrusteeAppointments.mockResolvedValue([
      { status: 'active', courtId: '081', chapter: '11', divisionCodes: ['081'] },
    ]);

    const result = await useCase.remapPage(makeMessage(), 25);

    expect(mockUpsert).not.toHaveBeenCalled();
    expect(mockDelete).not.toHaveBeenCalled();
    expect(result.documentsWritten).toBe(0);
    expect(result.documentsFailed).toBe(1);
    expect(result.permanentFailureCount).toBe(0);
  });

  test('a getCaseSummary failure mid-page rethrows instead of being counted as documentsFailed or a permanent mismatch', async () => {
    // Reviewer-flagged on PR #3090: a DXTR lookup failure says nothing about division coverage
    // and must not be conflated with a genuine division mismatch, which would otherwise make a
    // transient lookup blip indistinguishable from a permanent, un-retriable failure.
    const surrogateA = makeSurrogate({ id: 'surrogate-a', caseId: '081-25-00001' });
    const surrogateB = makeSurrogate({ id: 'surrogate-b', caseId: '081-25-00002' });
    mockGetSurrogatesByFingerprint.mockResolvedValue([surrogateA, surrogateB]);
    vi.spyOn(CaseManagement.prototype, 'getCaseSummary').mockRejectedValue(
      new Error('DXTR connection timed out'),
    );

    await expect(useCase.remapPage(makeMessage(), 25)).rejects.toThrow(
      /Unable to look up case summary/,
    );
    expect(mockUpsert).not.toHaveBeenCalled();
    expect(mockDelete).not.toHaveBeenCalled();
  });

  test('tracks a mix of success, permanent mismatch, and ordinary failure independently in one page', async () => {
    const covered = makeSurrogate({ id: 'surrogate-covered', caseId: '081-25-00001' });
    const mismatched = makeSurrogate({
      id: 'surrogate-mismatched',
      caseId: '081-25-00002',
      courtDivisionCode: '099',
      chapter: '13',
    });
    const ordinaryFailure = makeSurrogate({
      id: 'surrogate-ordinary-failure',
      caseId: '081-25-00003',
    });
    mockGetSurrogatesByFingerprint.mockResolvedValue([covered, mismatched, ordinaryFailure]);
    vi.spyOn(CaseManagement.prototype, 'getCaseSummary').mockImplementation(
      async (_context, caseId) => {
        if (caseId === mismatched.caseId) {
          return { caseId, courtId: '099', courtDivisionCode: '099', chapter: '13' } as CaseSummary;
        }
        return { caseId, courtId: '081', courtDivisionCode: '081', chapter: '7' } as CaseSummary;
      },
    );
    mockUpsert.mockImplementation(async (payload: { caseId: string }) => {
      if (payload.caseId === ordinaryFailure.caseId) {
        throw new Error('upsert failed');
      }
      return {};
    });

    const result = await useCase.remapPage(makeMessage(), 25);

    expect(result).toMatchObject({
      documentsWritten: 1,
      documentsFailed: 1,
      permanentFailureCount: 1,
    });
    expect(mockDelete).toHaveBeenCalledWith(covered.id);
    expect(mockDelete).not.toHaveBeenCalledWith(mismatched.id);
    expect(mockDelete).not.toHaveBeenCalledWith(ordinaryFailure.id);
  });
});
