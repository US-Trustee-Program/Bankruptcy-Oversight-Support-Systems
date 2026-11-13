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
import { SurrogateAppointment, TrusteeAppointmentVerificationRepository } from '../gateways.types';
import { SYSTEM_USER_REFERENCE } from '@common/cams/auditable';

const makeMessage = (
  overrides: Partial<TrusteeVerificationRemapMessage> = {},
): TrusteeVerificationRemapMessage => ({
  fingerprint: 'fp-abc123',
  resolvedTrusteeId: 'trustee-new',
  resolvedTrusteeName: 'New Trustee',
  verificationId: 'verification-1',
  ...overrides,
});

const makeSurrogate = (overrides: Partial<SurrogateAppointment> = {}): SurrogateAppointment =>
  ({
    documentType: 'CASE_APPOINTMENT',
    id: `surrogate-${overrides.caseId ?? '001'}`,
    caseId: '081-25-00001',
    trusteeId: 'fp-abc123',
    assignedOn: '2025-01-01T00:00:00.000Z',
    appointedDate: '2025-01-01',
    dateFiled: '2024-06-01',
    chapter: '7',
    courtId: '081',
    courtDivisionCode: '081',
    isSurrogate: true,
    variant: '{"firstName":"john","lastName":"doe"}',
    ...overrides,
  }) as SurrogateAppointment;

describe('TrusteeVerificationRemapUseCase', () => {
  let context: ApplicationContext;
  let useCase: TrusteeVerificationRemapUseCase;
  let mockGetSurrogatesByFingerprint: ReturnType<typeof vi.fn>;
  let mockGetActiveByCaseId: ReturnType<typeof vi.fn>;
  let mockUpdateCaseAppointment: ReturnType<typeof vi.fn>;
  let mockUpsert: ReturnType<typeof vi.fn>;
  let mockDelete: ReturnType<typeof vi.fn>;
  let mockGetTrusteeAppointments: ReturnType<typeof vi.fn>;
  let mockOpenOrJoin: ReturnType<
    typeof vi.fn<TrusteeAppointmentVerificationRepository['openOrJoin']>
  >;

  beforeEach(async () => {
    vi.restoreAllMocks();
    context = await createMockApplicationContext();

    mockGetSurrogatesByFingerprint = vi.fn().mockResolvedValue([]);
    mockGetActiveByCaseId = vi.fn().mockResolvedValue(null);
    mockUpdateCaseAppointment = vi.fn().mockResolvedValue({});
    mockUpsert = vi.fn().mockResolvedValue({});
    mockDelete = vi.fn().mockResolvedValue(undefined);
    // Covers makeSurrogate's default court fields (courtId/courtDivisionCode/chapter
    // '081'/'081'/'7'), so a surrogate passes the coverage check unless a test overrides this.
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

    mockOpenOrJoin = vi
      .fn<TrusteeAppointmentVerificationRepository['openOrJoin']>()
      .mockResolvedValue(undefined);
    vi.spyOn(factory, 'getTrusteeAppointmentVerificationRepository').mockReturnValue({
      openOrJoin: mockOpenOrJoin,
      search: vi.fn(),
      findById: vi.fn(),
      release: vi.fn(),
    });

    useCase = new TrusteeVerificationRemapUseCase(context);
  });

  const coveredChecks = {
    matchedCase: true,
    matchedTrustee: true,
    matchedTrusteeAppointment: true,
    matchedBy: 'identity-task',
  };

  describe('parked placeholders (case not yet in CAMS)', () => {
    const parked = () =>
      makeSurrogate({
        id: 'parked-placeholder',
        caseId: '081-26-00099',
        documentType: 'CASE_APPOINTMENT_UNATTACHED',
        unassignedOn: '2026-10-15',
      });

    test('a task listing one placed and one parked case: the placed one becomes an appointment, the parked one stays parked with its trustee changed', async () => {
      const placed = makeSurrogate({ id: 'placed-placeholder' });
      mockGetSurrogatesByFingerprint.mockResolvedValue([placed, parked()]);

      const result = await useCase.remapPage(makeMessage(), 25);

      expect(result.documentsWritten).toBe(2);
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({ caseId: placed.caseId, trusteeId: 'trustee-new' }),
      );
      expect(mockUpsert).toHaveBeenCalledWith(
        {
          caseId: '081-26-00099',
          trusteeId: 'trustee-new',
          assignedOn: '2025-01-01T00:00:00.000Z',
          appointedDate: '2025-01-01',
          unassignedOn: '2026-10-15',
          dateFiled: '2024-06-01',
          chapter: '7',
          courtId: '081',
          courtDivisionCode: '081',
          checks: coveredChecks,
        },
        'CASE_APPOINTMENT_UNATTACHED',
      );
      expect(mockDelete).toHaveBeenCalledWith('placed-placeholder');
      expect(mockDelete).toHaveBeenCalledWith('parked-placeholder');
    });

    test('an open parked placeholder stays open and never closes the case active appointment', async () => {
      // No CAMS case to settle against: even when an earlier, different-trustee appointment is
      // active for the caseId, a parked row is neither closed nor used to close anything.
      const activeEarlier: CaseAppointment = {
        id: 'active-other',
        caseId: '081-26-00099',
        trusteeId: 'trustee-other',
        assignedOn: '2024-01-01',
        createdOn: '2024-01-01T00:00:00Z',
        createdBy: { id: 'SYSTEM', name: 'SYSTEM' },
        updatedOn: '2024-01-01T00:00:00Z',
        updatedBy: { id: 'SYSTEM', name: 'SYSTEM' },
      };
      mockGetActiveByCaseId.mockResolvedValue(activeEarlier);
      mockGetSurrogatesByFingerprint.mockResolvedValue([
        makeSurrogate({
          id: 'parked-open',
          caseId: '081-26-00099',
          documentType: 'CASE_APPOINTMENT_UNATTACHED',
        }),
      ]);

      const result = await useCase.remapPage(makeMessage(), 25);

      expect(result.documentsWritten).toBe(1);
      expect(mockUpdateCaseAppointment).not.toHaveBeenCalled();
      expect(mockUpsert).toHaveBeenCalledTimes(1);
      expect(mockUpsert.mock.calls[0][0]).not.toHaveProperty('unassignedOn');
      expect(mockUpsert.mock.calls[0][1]).toBe('CASE_APPOINTMENT_UNATTACHED');
      expect(mockDelete).toHaveBeenCalledWith('parked-open');
    });

    test.each([
      ['placed', makeSurrogate({ id: 'placed-placeholder' })],
      ['parked', parked()],
    ])(
      'upserts the %s appointment before deleting the placeholder',
      async (_label, placeholder) => {
        mockGetSurrogatesByFingerprint.mockResolvedValue([placeholder]);

        await useCase.remapPage(makeMessage(), 25);

        expect(mockUpsert.mock.invocationCallOrder[0]).toBeLessThan(
          mockDelete.mock.invocationCallOrder[0],
        );
      },
    );

    test('a parked placeholder the resolved trustee does not cover stays parked, records the miss, and opens no task', async () => {
      mockGetSurrogatesByFingerprint.mockResolvedValue([parked()]);
      mockGetTrusteeAppointments.mockResolvedValue([
        { status: 'active', courtId: '081', chapter: '13', divisionCodes: ['081'] },
      ]);

      const result = await useCase.remapPage(makeMessage(), 25);

      expect(result.documentsWritten).toBe(1);
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          checks: expect.objectContaining({ matchedTrusteeAppointment: false }),
        }),
        'CASE_APPOINTMENT_UNATTACHED',
      );
      expect(mockOpenOrJoin).not.toHaveBeenCalled();
      expect(mockDelete).toHaveBeenCalledWith('parked-placeholder');
    });
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
        courtId: surrogate.courtId,
        courtDivisionCode: surrogate.courtDivisionCode,
        checks: coveredChecks,
      }),
    );
    expect(mockUpsert.mock.calls[0][0]).not.toHaveProperty('isSurrogate');
    expect(mockOpenOrJoin).not.toHaveBeenCalled();
    expect(mockDelete).toHaveBeenCalledWith(surrogate.id);
    const upsertOrder = mockUpsert.mock.invocationCallOrder[0];
    const deleteOrder = mockDelete.mock.invocationCallOrder[0];
    expect(upsertOrder).toBeLessThan(deleteOrder);
    expect(result).toEqual({
      documentsWritten: 1,
      documentsFailed: 0,
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
      totalCandidates: 0,
      pageSize: 0,
      remainingCount: 0,
    });
  });

  test("keeps the surrogate's own matchedBy when it recorded one", async () => {
    mockGetSurrogatesByFingerprint.mockResolvedValue([
      makeSurrogate({
        checks: {
          matchedCase: true,
          matchedTrustee: false,
          matchedTrusteeAppointment: false,
          matchedBy: 'variation',
        },
      }),
    ]);

    await useCase.remapPage(makeMessage(), 25);

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ checks: { ...coveredChecks, matchedBy: 'variation' } }),
    );
  });

  describe('a surrogate the resolved trustee does not cover (CAMS-956)', () => {
    test('writes the real appointment recording the miss, opens or joins the appointment task, then deletes the surrogate', async () => {
      const surrogate = makeSurrogate({ courtDivisionCode: '099', chapter: '13' });
      mockGetSurrogatesByFingerprint.mockResolvedValue([surrogate]);
      // Resolved trustee is only assigned to '081'/'7' (the default appointment), not '099'/'13'.

      const result = await useCase.remapPage(makeMessage(), 25);

      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          caseId: surrogate.caseId,
          trusteeId: 'trustee-new',
          checks: { ...coveredChecks, matchedTrusteeAppointment: false },
        }),
      );
      expect(mockOpenOrJoin).toHaveBeenCalledWith(
        { trusteeId: 'trustee-new', courtId: '081', divisionCode: '099', chapter: '13' },
        surrogate.caseId,
        'no-appointment',
        SYSTEM_USER_REFERENCE,
      );
      expect(mockUpsert.mock.invocationCallOrder[0]).toBeLessThan(
        mockOpenOrJoin.mock.invocationCallOrder[0],
      );
      expect(mockOpenOrJoin.mock.invocationCallOrder[0]).toBeLessThan(
        mockDelete.mock.invocationCallOrder[0],
      );
      expect(result).toEqual({
        documentsWritten: 1,
        documentsFailed: 0,
        totalCandidates: 1,
        pageSize: 1,
        remainingCount: 0,
      });
    });

    test("gives the appointment-inactive reason when the trustee's appointment for the tuple is not active", async () => {
      const surrogate = makeSurrogate();
      mockGetSurrogatesByFingerprint.mockResolvedValue([surrogate]);
      mockGetTrusteeAppointments.mockResolvedValue([
        { status: 'inactive', courtId: '081', chapter: '7', divisionCodes: ['081'] },
      ]);

      await useCase.remapPage(makeMessage(), 25);

      expect(mockOpenOrJoin).toHaveBeenCalledWith(
        { trusteeId: 'trustee-new', courtId: '081', divisionCode: '081', chapter: '7' },
        surrogate.caseId,
        'appointment-inactive',
        SYSTEM_USER_REFERENCE,
      );
    });

    test.each([['courtId'], ['courtDivisionCode'], ['chapter']])(
      'still remaps a surrogate row with no %s, records it uncovered, and opens no task',
      async (missingField) => {
        const surrogate = makeSurrogate({ [missingField]: undefined });
        mockGetSurrogatesByFingerprint.mockResolvedValue([surrogate]);

        const result = await useCase.remapPage(makeMessage(), 25);

        expect(mockUpsert).toHaveBeenCalledWith(
          expect.objectContaining({
            checks: expect.objectContaining({ matchedTrusteeAppointment: false }),
          }),
        );
        expect(mockUpsert.mock.calls[0][0]).not.toHaveProperty(missingField);
        expect(mockOpenOrJoin).not.toHaveBeenCalled();
        expect(mockDelete).toHaveBeenCalledWith(surrogate.id);
        expect(result.documentsWritten).toBe(1);
      },
    );

    test('a transient error writing the task rethrows and leaves the surrogate in place', async () => {
      mockGetSurrogatesByFingerprint.mockResolvedValue([
        makeSurrogate({ courtDivisionCode: '099' }),
      ]);
      mockOpenOrJoin.mockRejectedValue(new TooManyRequestsError('TEST'));

      await expect(useCase.remapPage(makeMessage(), 25)).rejects.toThrow(TooManyRequestsError);
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          checks: expect.objectContaining({ matchedTrusteeAppointment: false }),
        }),
      );
      expect(mockDelete).not.toHaveBeenCalled();
    });

    test('any other error writing the task counts as a failure and leaves the surrogate for the next attempt', async () => {
      mockGetSurrogatesByFingerprint.mockResolvedValue([
        makeSurrogate({ courtDivisionCode: '099' }),
      ]);
      mockOpenOrJoin.mockRejectedValue(new Error('write failed'));

      const result = await useCase.remapPage(makeMessage(), 25);

      expect(mockDelete).not.toHaveBeenCalled();
      expect(result).toMatchObject({ documentsWritten: 0, documentsFailed: 1 });
    });
  });

  test('counts a documentsFailed when the surrogate row carries a malformed chapter, even though it passed the division/chapter match', async () => {
    // isAppointmentMatch's normalizeChapter is deliberately LOOSE for matching purposes --
    // it extracts leading digits, so a dirty value like '11X' normalizes to '11' and
    // matches an active chapter-11 appointment -- but assertValidChapter's storage guard is
    // STRICT (exact membership in VALID_CASE_CHAPTERS), so '11X' itself is rejected. A row
    // can therefore pass the match check above and still fail validation here.
    const surrogate = makeSurrogate({
      chapter: '11X' as CaseAppointment['chapter'],
    });
    mockGetSurrogatesByFingerprint.mockResolvedValue([surrogate]);
    mockGetTrusteeAppointments.mockResolvedValue([
      { status: 'active', courtId: '081', chapter: '11', divisionCodes: ['081'] },
    ]);

    const result = await useCase.remapPage(makeMessage(), 25);

    expect(mockUpsert).not.toHaveBeenCalled();
    expect(mockDelete).not.toHaveBeenCalled();
    expect(result.documentsWritten).toBe(0);
    expect(result.documentsFailed).toBe(1);
  });

  test('tracks a mix of covered, uncovered, and failed surrogates in one page', async () => {
    const covered = makeSurrogate({ id: 'surrogate-covered', caseId: '081-25-00001' });
    const uncovered = makeSurrogate({
      id: 'surrogate-uncovered',
      caseId: '081-25-00002',
      courtDivisionCode: '099',
      chapter: '13',
    });
    const ordinaryFailure = makeSurrogate({
      id: 'surrogate-ordinary-failure',
      caseId: '081-25-00003',
    });
    mockGetSurrogatesByFingerprint.mockResolvedValue([covered, uncovered, ordinaryFailure]);
    mockUpsert.mockImplementation(async (payload: { caseId: string }) => {
      if (payload.caseId === ordinaryFailure.caseId) {
        throw new Error('upsert failed');
      }
      return {};
    });

    const result = await useCase.remapPage(makeMessage(), 25);

    expect(result).toMatchObject({ documentsWritten: 2, documentsFailed: 1 });
    expect(mockOpenOrJoin).toHaveBeenCalledTimes(1);
    expect(mockOpenOrJoin).toHaveBeenCalledWith(
      expect.anything(),
      uncovered.caseId,
      'no-appointment',
      expect.anything(),
    );
    expect(mockDelete).toHaveBeenCalledWith(covered.id);
    expect(mockDelete).toHaveBeenCalledWith(uncovered.id);
    expect(mockDelete).not.toHaveBeenCalledWith(ordinaryFailure.id);
  });
});
