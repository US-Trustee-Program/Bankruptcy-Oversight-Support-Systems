import { NotFoundError } from '../../common-errors/not-found-error';
import MockData from '@common/cams/test-utilities/mock-data';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import { ApplicationContext } from '../../adapters/types/basic';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import SyncTrusteeCaseAppointments, {
  assertSyncedCase,
  throwIfTransientSoftCloseFailure,
  createNewAppointment,
  closeExistingAppointment,
  softCloseExistingAppointment,
} from './sync-trustee-case-appointments';
import factory from '../../factory';
import { TrusteeAppointmentSyncEvent } from '@common/cams/dataflow-events';
import { CaseAppointment, CaseAppointmentChecks } from '@common/cams/trustee-appointments';
import {
  CasesRepository,
  RuntimeStateRepository,
  TrusteeAppointmentRegionSyncState,
  TrusteeAppointmentsRepository,
  TrusteeCaseAppointmentsRepository,
  TrusteeAppointmentVerificationRepository,
  TrusteeMatchVerificationRepository,
  TrusteesRepository,
  TrusteeVariationRepository,
  TrusteeProfessionalIdsRepository,
} from '../gateways.types';
import * as pipelineOrchestrator from './trustee-match-pipeline-orchestrator';
import {
  createTrusteeInitialState,
  addCandidate,
  addScore,
  TrusteePipelineState,
} from './trustee-match-pipeline';
import { buildVariant, computeFingerprint } from './trustee-variant.helpers';
import { closeDeferred } from '../../deferrable/defer-close';
import { CamsError } from '../../common-errors/cams-error';
import { TooManyRequestsError } from '../../common-errors/too-many-requests-error';
import { GatewayTimeoutError } from '../../common-errors/gateway-timeout';
import { BadRequestError } from '../../common-errors/bad-request';
import { SyncedCase } from '@common/cams/cases';
import { SYSTEM_USER_REFERENCE } from '@common/cams/auditable';

/** Builds a resolved TrusteePipelineState (state.match set) for mocking runTrusteeMatchPipeline. */
function makeResolvedState(trusteeId: string, resolvedBy = 'resolveByPhone'): TrusteePipelineState {
  const state = createTrusteeInitialState({ fullName: 'Jane Doe' });
  state.match = { trusteeId, score: {}, resolvedBy };
  return state;
}

/**
 * Builds an unresolved TrusteePipelineState (state.match null) with the given number of
 * candidates in the pool. The first nameMatchCount candidates (default: all) pass doesNameMatch as
 * a strong match and carry explicit source contact data (doesSourceTrusteeHaveAddressAndPhone
 * passing), so they are genuine evidence under the shared rule; the rest fail doesNameMatch and
 * carry a different name. The rule calls the state 'ambiguous' only when 2+ candidates are
 * genuine, otherwise 'no match'. Scores are injected rather than derived from the names.
 */
function makeUnresolvedState(
  candidateCount: number,
  nameMatchCount = candidateCount,
): TrusteePipelineState {
  const state = createTrusteeInitialState({ fullName: 'Jane Doe' });
  for (let i = 0; i < candidateCount; i++) {
    const isNameMatch = i < nameMatchCount;
    const candidate = addCandidate(
      state,
      isNameMatch
        ? { trusteeId: `candidate-${i}`, firstName: 'Jane', lastName: 'Doe', name: 'Jane Doe' }
        : { trusteeId: `candidate-${i}`, firstName: 'Zed', lastName: 'Roe', name: 'Zed Roe' },
      'recallByName',
    );
    addScore(
      candidate,
      'doesNameMatch',
      isNameMatch ? { pass: true, quality: 'strong' } : { pass: false },
    );
    addScore(candidate, 'doesSourceTrusteeHaveAddressAndPhone', { pass: true });
  }
  return state;
}

/** Builds a skipped TrusteePipelineState (state.skip true — the pipeline's own administrative
 * placeholder gate fired). */
function makeSkippedState(): TrusteePipelineState {
  const state = createTrusteeInitialState({ fullName: 'U.S. Trustee' });
  state.skip = true;
  return state;
}

/** Builds a TrusteePipelineState carrying a processing failure (state.error set). */
function makeErrorState(error: CamsError): TrusteePipelineState {
  const state = createTrusteeInitialState({ fullName: 'Jane Doe' });
  state.error = error;
  return state;
}

describe('SyncTrusteeCaseAppointments', () => {
  describe('processAppointments', () => {
    let context: ApplicationContext;
    let mockCasesRepo: Partial<CasesRepository>;
    let mockAppointmentsRepo: Partial<TrusteeAppointmentsRepository>;
    let mockTrusteeCaseAppointmentsRepo: Partial<TrusteeCaseAppointmentsRepository>;
    let mockTrusteesRepo: Partial<TrusteesRepository>;
    let mockVerificationRepo: Partial<TrusteeMatchVerificationRepository>;
    let mockVariationRepo: Partial<TrusteeVariationRepository>;
    let mockProfessionalIdsRepo: Partial<TrusteeProfessionalIdsRepository>;
    let mockAppointmentVerificationRepo: Partial<TrusteeAppointmentVerificationRepository>;

    const makeEvent = (caseId: string, fullName: string): TrusteeAppointmentSyncEvent => {
      const [firstName, ...rest] = fullName.split(' ');
      return {
        caseId,
        courtId: '081',
        source: 'DXTR',
        courtDivisionCode: '081',
        chapter: '7',
        // appointedDate must be present: applyResolvedTrustee now throws rather than falling
        // back to wall-clock time when it's missing, since wall-clock would break upsert()'s
        // natural-key idempotency across retries.
        appointedDate: '2024-01-15',
        // firstName/lastName are derived from fullName (rather than left undefined like the
        // real fullName-only shape used to be) so each distinct fullName in this test file
        // produces a distinct trustee-variant fingerprint — otherwise every event sharing the
        // all-undefined structured-name fields would collide on the Slice 5 memoization bucket.
        sourceTrustee: { fullName, firstName, lastName: rest.join(' ') || undefined },
      };
    };

    /** An active appointment covering makeEvent's court 081, division 081, chapter 7. */
    const coveringAppointment = () =>
      MockData.getTrusteeAppointment({
        trusteeId: 'trustee-123',
        courtId: '081',
        divisionCode: undefined,
        divisionCodes: ['081'],
        chapter: '7',
        status: 'active',
      });

    const makeAcmsEvent = (
      caseId: string,
      fullName: string,
      acmsProfessionalId: string,
    ): TrusteeAppointmentSyncEvent => ({
      ...makeEvent(caseId, fullName),
      source: 'ACMS',
      acmsProfessionalId,
    });

    beforeEach(async () => {
      vi.restoreAllMocks();
      if (context) await closeDeferred(context);
      context = await createMockApplicationContext();

      mockCasesRepo = {
        getCaseOrMovedCase: vi.fn().mockResolvedValue({
          caseId: 'case-001',
          trusteeId: undefined,
          courtId: '081',
          courtDivisionCode: '081',
          chapter: '7',
          dateFiled: '2026-01-07',
        }),
        syncDxtrCase: vi.fn().mockResolvedValue(undefined),
        release: vi.fn(),
      };

      mockAppointmentsRepo = {
        getTrusteeAppointments: vi.fn().mockResolvedValue([coveringAppointment()]),
        release: vi.fn(),
      };

      mockTrusteeCaseAppointmentsRepo = {
        getActiveByCaseId: vi.fn().mockResolvedValue(null),
        getByCaseId: vi.fn().mockResolvedValue([]),
        upsert: vi.fn().mockResolvedValue({}),
        updateCaseAppointment: vi.fn().mockResolvedValue({}),
        findStrandedActiveInTrusteePartition: vi.fn().mockResolvedValue(null),
        // Partition-repair and surrogate-cleanup defaults: both partitions agree, and no
        // surrogates exist. Tests that exercise those paths override these.
        existsInTrusteePartition: vi.fn().mockResolvedValue(true),
        replaceOneInTrusteePartition: vi.fn().mockResolvedValue(undefined),
        getSurrogatesByFingerprint: vi.fn().mockResolvedValue([]),
        release: vi.fn(),
      };

      mockTrusteesRepo = {
        read: vi.fn().mockResolvedValue({
          trusteeId: 'trustee-123',
          name: 'John Doe',
          public: { address: {} },
        }),
        release: vi.fn(),
      };

      mockVerificationRepo = {
        getVerification: vi.fn().mockResolvedValue(null),
        findByFingerprint: vi.fn().mockResolvedValue([]),
        upsertVerification: vi.fn().mockResolvedValue(undefined),
        release: vi.fn(),
      };

      mockVariationRepo = {
        findByFingerprint: vi.fn().mockResolvedValue([]),
        createVariation: vi.fn().mockResolvedValue({}),
        release: vi.fn(),
      };

      mockProfessionalIdsRepo = {
        findByAcmsProfessionalId: vi.fn().mockResolvedValue([]),
        release: vi.fn(),
      };

      vi.spyOn(factory, 'getCasesRepository').mockReturnValue(mockCasesRepo as CasesRepository);
      vi.spyOn(factory, 'getTrusteeAppointmentsRepository').mockReturnValue(
        mockAppointmentsRepo as TrusteeAppointmentsRepository,
      );
      vi.spyOn(factory, 'getTrusteeCaseAppointmentsRepository').mockReturnValue(
        mockTrusteeCaseAppointmentsRepo as TrusteeCaseAppointmentsRepository,
      );
      vi.spyOn(factory, 'getTrusteesRepository').mockReturnValue(
        mockTrusteesRepo as TrusteesRepository,
      );
      vi.spyOn(factory, 'getTrusteeMatchVerificationRepository').mockReturnValue(
        mockVerificationRepo as TrusteeMatchVerificationRepository,
      );
      vi.spyOn(factory, 'getTrusteeVariationRepository').mockReturnValue(
        mockVariationRepo as TrusteeVariationRepository,
      );
      vi.spyOn(factory, 'getTrusteeProfessionalIdsRepository').mockReturnValue(
        mockProfessionalIdsRepo as TrusteeProfessionalIdsRepository,
      );
      mockAppointmentVerificationRepo = {
        openOrJoin: vi.fn().mockResolvedValue(undefined),
        release: vi.fn(),
      };
      vi.spyOn(factory, 'getTrusteeAppointmentVerificationRepository').mockReturnValue(
        mockAppointmentVerificationRepo as TrusteeAppointmentVerificationRepository,
      );
      vi.spyOn(pipelineOrchestrator, 'runTrusteeMatchPipeline').mockResolvedValue(
        makeResolvedState('trustee-123'),
      );
    });

    describe('appointment task (CAMS-956)', () => {
      const expectedKey = {
        trusteeId: 'trustee-123',
        courtId: '081',
        divisionCode: '081',
        chapter: '7',
      };

      beforeEach(() => {
        (mockAppointmentsRepo.getTrusteeAppointments as ReturnType<typeof vi.fn>).mockResolvedValue(
          [],
        );
      });

      test("opens or joins an appointment task for the event's court, division and chapter after an uncovered write", async () => {
        const { successCount } = await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          [makeEvent('case-001', 'John Doe')],
        );

        expect(mockTrusteeCaseAppointmentsRepo.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            caseId: 'case-001',
            trusteeId: 'trustee-123',
            checks: expect.objectContaining({ matchedTrusteeAppointment: false }),
          }),
        );
        expect(mockAppointmentVerificationRepo.openOrJoin).toHaveBeenCalledWith(
          expectedKey,
          'case-001',
          'no-appointment',
          SYSTEM_USER_REFERENCE,
        );
        expect(successCount).toBe(1);
      });

      test("derives the task reason from the trustee's appointments", async () => {
        (mockAppointmentsRepo.getTrusteeAppointments as ReturnType<typeof vi.fn>).mockResolvedValue(
          [
            MockData.getTrusteeAppointment({
              trusteeId: 'trustee-123',
              courtId: '081',
              divisionCodes: ['081'],
              chapter: '7',
              status: 'inactive',
            }),
          ],
        );

        await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          [makeEvent('case-001', 'John Doe')],
        );

        expect(mockAppointmentVerificationRepo.openOrJoin).toHaveBeenCalledWith(
          expectedKey,
          'case-001',
          'appointment-inactive',
          SYSTEM_USER_REFERENCE,
        );
      });

      test('does not open a task when an active appointment covers the case', async () => {
        (mockAppointmentsRepo.getTrusteeAppointments as ReturnType<typeof vi.fn>).mockResolvedValue(
          [
            MockData.getTrusteeAppointment({
              trusteeId: 'trustee-123',
              courtId: '081',
              divisionCodes: ['081'],
              chapter: '7',
              status: 'active',
            }),
          ],
        );

        await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          [makeEvent('case-001', 'John Doe')],
        );

        expect(mockAppointmentVerificationRepo.openOrJoin).not.toHaveBeenCalled();
      });

      test('does not open a task for an uncovered parked write', async () => {
        (mockCasesRepo.getCaseOrMovedCase as ReturnType<typeof vi.fn>).mockResolvedValue(null);

        await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          [{ ...makeEvent('case-001', 'John Doe'), source: 'ACMS', dateFiled: '2026-10-30' }],
        );

        expect(mockTrusteeCaseAppointmentsRepo.upsert).toHaveBeenCalledWith(
          expect.anything(),
          'CASE_APPOINTMENT_UNATTACHED',
        );
        expect(mockAppointmentVerificationRepo.openOrJoin).not.toHaveBeenCalled();
      });

      const activeAppointmentFor = (trusteeId: string, assignedOn: string) => ({
        id: 'ca-old',
        caseId: 'case-001',
        trusteeId,
        assignedOn,
        createdOn: '2024-01-01T00:00:00Z',
        createdBy: { id: 'system', name: 'System' },
        updatedOn: '2024-01-01T00:00:00Z',
        updatedBy: { id: 'system', name: 'System' },
      });

      test("opens a task and still dead-letters the event when the previous trustee's soft-close permanently failed", async () => {
        (
          mockTrusteeCaseAppointmentsRepo.getActiveByCaseId as ReturnType<typeof vi.fn>
        ).mockResolvedValue(activeAppointmentFor('old-trustee', '2024-01-01T00:00:00Z'));
        (
          mockTrusteeCaseAppointmentsRepo.updateCaseAppointment as ReturnType<typeof vi.fn>
        ).mockRejectedValue(new Error('Cosmos write failed'));

        const { dlqMessages } = await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          [makeEvent('case-001', 'John Doe')],
        );

        expect(mockTrusteeCaseAppointmentsRepo.upsert).toHaveBeenCalledWith(
          expect.objectContaining({ caseId: 'case-001', trusteeId: 'trustee-123' }),
        );
        expect(dlqMessages).toEqual([
          expect.objectContaining({ mismatchReason: 'SOFT_CLOSE_WRITE_FAILED' }),
        ]);
        expect(mockAppointmentVerificationRepo.openOrJoin).toHaveBeenCalledWith(
          expectedKey,
          'case-001',
          'no-appointment',
          SYSTEM_USER_REFERENCE,
        );
      });

      test('does not open a task when the source disposition (DISP_DATE) writes the appointment closed', async () => {
        await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          [{ ...makeEvent('case-001', 'John Doe'), unassignedOn: '2024-06-30' }],
        );

        expect(mockTrusteeCaseAppointmentsRepo.upsert).toHaveBeenCalledWith(
          expect.objectContaining({ caseId: 'case-001', unassignedOn: '2024-06-30' }),
        );
        expect(mockAppointmentVerificationRepo.openOrJoin).not.toHaveBeenCalled();
      });

      test("does not open a task for an out-of-order row written closed behind the case's later active appointment", async () => {
        (
          mockTrusteeCaseAppointmentsRepo.getActiveByCaseId as ReturnType<typeof vi.fn>
        ).mockResolvedValue(activeAppointmentFor('newer-trustee', '2024-03-01T00:00:00Z'));

        await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          [makeEvent('case-001', 'John Doe')],
        );

        expect(mockTrusteeCaseAppointmentsRepo.upsert).toHaveBeenCalledWith(
          expect.objectContaining({ caseId: 'case-001', trusteeId: 'trustee-123' }),
          'CASE_APPOINTMENT',
          { fallbackUnassignedOn: '2024-02-29' },
        );
        expect(mockAppointmentVerificationRepo.openOrJoin).not.toHaveBeenCalled();
      });

      test("does not open a task when the source disposition closes the trustee's own active appointment", async () => {
        (
          mockTrusteeCaseAppointmentsRepo.getActiveByCaseId as ReturnType<typeof vi.fn>
        ).mockResolvedValue(activeAppointmentFor('trustee-123', '2024-01-15T00:00:00Z'));
        (
          mockTrusteeCaseAppointmentsRepo.existsInTrusteePartition as ReturnType<typeof vi.fn>
        ).mockResolvedValue(true);

        await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          [{ ...makeEvent('case-001', 'John Doe'), unassignedOn: '2024-06-30' }],
        );

        expect(mockTrusteeCaseAppointmentsRepo.updateCaseAppointment).toHaveBeenCalledWith(
          expect.objectContaining({ trusteeId: 'trustee-123', unassignedOn: '2024-06-30' }),
        );
        expect(mockAppointmentVerificationRepo.openOrJoin).not.toHaveBeenCalled();
      });

      test('routes a throttled task write to retryableEvents like any other write', async () => {
        (mockAppointmentVerificationRepo.openOrJoin as ReturnType<typeof vi.fn>).mockRejectedValue(
          new TooManyRequestsError('TEST', { message: 'Throttled.' }),
        );

        const { dlqMessages, retryableEvents, successCount } =
          await SyncTrusteeCaseAppointments.processAppointments(
            SyncTrusteeCaseAppointments.createDeps(context),
            [makeEvent('case-001', 'John Doe')],
          );

        expect(retryableEvents).toEqual([expect.objectContaining({ caseId: 'case-001' })]);
        expect(dlqMessages).toHaveLength(0);
        expect(successCount).toBe(0);
      });
    });

    describe('court fields come from the event, not the CAMS case', () => {
      // Deliberately different from the getCaseOrMovedCase mock (081/081/7/2026-01-07): ACMS
      // source data is ground truth, and parked rows (cases not in CAMS) have no SyncedCase.
      const courtFields = {
        courtId: '0208',
        courtDivisionCode: '082',
        chapter: '13',
        dateFiled: '2023-11-20',
        closedDate: '2024-06-30',
        reopenedDate: '2024-08-01',
      };

      test("an auto-linked appointment records the event's court fields (court, division, chapter, filed/closed/reopened dates)", async () => {
        await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          [{ ...makeEvent('case-001', 'John Doe'), ...courtFields }],
        );

        expect(mockTrusteeCaseAppointmentsRepo.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            caseId: 'case-001',
            trusteeId: 'trustee-123',
            ...courtFields,
          }),
        );
      });

      test("a placeholder records the event's court fields (court, division, chapter, filed/closed/reopened dates)", async () => {
        (
          pipelineOrchestrator.runTrusteeMatchPipeline as ReturnType<typeof vi.fn>
        ).mockResolvedValueOnce(makeUnresolvedState(0));

        await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          [{ ...makeEvent('case-001', 'Ghost Trustee'), ...courtFields }],
        );

        expect(mockTrusteeCaseAppointmentsRepo.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            caseId: 'case-001',
            isSurrogate: true,
            ...courtFields,
          }),
        );
      });

      test('an invalid chapter on the event is dead-lettered and nothing is written', async () => {
        const { dlqMessages } = await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          [{ ...makeEvent('case-001', 'John Doe'), ...courtFields, chapter: '99' }],
        );

        expect(dlqMessages).toEqual([
          expect.objectContaining({
            error: expect.objectContaining({
              message: expect.stringContaining('Invalid chapter value "99"'),
            }),
          }),
        ]);
        expect(mockTrusteeCaseAppointmentsRepo.upsert).not.toHaveBeenCalled();
      });

      test.each([
        ['chapter', { chapter: undefined }],
        ['courtDivisionCode', { courtDivisionCode: undefined }],
        ['dateFiled', { dateFiled: undefined }],
        ['closedDate', { closedDate: undefined }],
        ['reopenedDate', { reopenedDate: undefined }],
      ])('an event with no %s writes the row without that key', async (field, omitted) => {
        await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          [{ ...makeEvent('case-001', 'John Doe'), ...courtFields, ...omitted }],
        );

        const [payload] = (mockTrusteeCaseAppointmentsRepo.upsert as ReturnType<typeof vi.fn>).mock
          .calls[0];
        expect(payload).toEqual(expect.objectContaining({ caseId: 'case-001', courtId: '0208' }));
        expect(payload).not.toHaveProperty(field);
      });
    });

    test('should create a new CASE_APPOINTMENT when no existing appointment', async () => {
      const events = [makeEvent('case-001', 'John Doe')];

      const { successCount, dlqMessages, scenarioDistribution } =
        await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          events,
        );

      expect(mockTrusteeCaseAppointmentsRepo.getActiveByCaseId).toHaveBeenCalledWith('case-001');
      expect(mockTrusteeCaseAppointmentsRepo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          caseId: 'case-001',
          trusteeId: 'trustee-123',
          assignedOn: expect.any(String),
        }),
      );
      expect(mockTrusteeCaseAppointmentsRepo.updateCaseAppointment).not.toHaveBeenCalled();
      expect(successCount).toBe(1);
      expect(dlqMessages).toHaveLength(0);
      expect(scenarioDistribution.autoMatchCount).toBe(1);
      expect(scenarioDistribution.noMatchCount).toBe(0);
      expect(scenarioDistribution.multipleMatchCount).toBe(0);
      expect(mockVerificationRepo.upsertVerification).not.toHaveBeenCalled();
    });

    test('produces the same assignedOn (and thus one natural-key row, not two) when the same event is reprocessed', async () => {
      // Regression test for the double-insert bug: upsert()'s natural key is
      // documentType + caseId + trusteeId + assignedOn. If assignedOn were derived from
      // wall-clock time (the old behavior), reprocessing the identical event would produce a
      // different assignedOn on each call, so the real repository's replaceOne(..., upsert:
      // true) would INSERT a second row instead of replacing the first — leaving two active
      // appointments. Deriving assignedOn from the event's own stable appointedDate means the
      // natural key — and therefore the upsert target — is identical across reprocessing.
      const event: TrusteeAppointmentSyncEvent = {
        ...makeEvent('case-001', 'John Doe'),
        appointedDate: '2026-04-07',
      };

      await SyncTrusteeCaseAppointments.processAppointments(
        SyncTrusteeCaseAppointments.createDeps(context),
        [event],
      );
      await SyncTrusteeCaseAppointments.processAppointments(
        SyncTrusteeCaseAppointments.createDeps(context),
        [event],
      );

      expect(mockTrusteeCaseAppointmentsRepo.upsert).toHaveBeenCalledTimes(2);
      const [firstCall, secondCall] = (
        mockTrusteeCaseAppointmentsRepo.upsert as ReturnType<typeof vi.fn>
      ).mock.calls;
      const naturalKey = (call: unknown[]) => {
        const arg = call[0] as { caseId: string; trusteeId: string; assignedOn: string };
        return { caseId: arg.caseId, trusteeId: arg.trusteeId, assignedOn: arg.assignedOn };
      };
      expect(naturalKey(firstCall)).toEqual(naturalKey(secondCall));
    });

    test('routes to dlqMessages with a loud, unambiguous error log instead of falling back to wall-clock time when appointedDate is missing', async () => {
      // parseDxtrDate (cases.dxtr.gateway.ts) returns undefined for a blank/'000000'/malformed
      // source date — a genuine DXTR data-quality condition, not a hypothetical one. Falling
      // back to wall-clock time here would defeat upsert()'s natural-key idempotency (a retry
      // of this same event would compute a different assignedOn and insert a duplicate active
      // row), so this must surface loudly instead of silently guessing.
      const errorSpy = vi.spyOn(context.logger, 'error');
      const event: TrusteeAppointmentSyncEvent = {
        ...makeEvent('case-001', 'John Doe'),
        appointedDate: undefined,
      };

      const { successCount, dlqMessages } = await SyncTrusteeCaseAppointments.processAppointments(
        SyncTrusteeCaseAppointments.createDeps(context),
        [event],
      );

      expect(mockTrusteeCaseAppointmentsRepo.upsert).not.toHaveBeenCalled();
      expect(successCount).toBe(0);
      expect(dlqMessages).toHaveLength(1);
      expect(errorSpy).toHaveBeenCalledWith(
        'SYNC-TRUSTEE-CASE-APPOINTMENTS-USE-CASE',
        expect.stringContaining('TRUSTEE APPOINTMENT DATA INTEGRITY ERROR'),
      );
    });

    test('routes an event that throws before matching to dlqMessages and still processes the rest of the page', async () => {
      // No producer sends an event without dxtrTrustee today; it stands in for any throw from
      // the pre-match steps (skip-reason checks, variant/fingerprint), which run before
      // processOneEvent's catch. Without a per-event boundary, that throw would discard the
      // whole page and send it to the native poison queue.
      const malformed = {
        ...makeEvent('case-002', 'Bad Event'),
        sourceTrustee: undefined,
      } as unknown as TrusteeAppointmentSyncEvent;
      const events = [malformed, makeEvent('case-001', 'John Doe')];

      const { successCount, dlqMessages } = await SyncTrusteeCaseAppointments.processAppointments(
        SyncTrusteeCaseAppointments.createDeps(context),
        events,
      );

      expect(dlqMessages).toEqual([
        expect.objectContaining({ caseId: 'case-002', error: expect.any(CamsError) }),
      ]);
      expect(successCount).toBe(1);
    });

    test('does nothing further when the same trustee is already active in both partitions', async () => {
      const existingAppointment: CaseAppointment = {
        id: 'ca-1',
        caseId: 'case-001',
        trusteeId: 'trustee-123',
        assignedOn: '2024-01-15',
        createdOn: '2024-01-01T00:00:00Z',
        createdBy: { id: 'system', name: 'System' },
        updatedOn: '2024-01-01T00:00:00Z',
        updatedBy: { id: 'system', name: 'System' },
      };
      (
        mockTrusteeCaseAppointmentsRepo.getActiveByCaseId as ReturnType<typeof vi.fn>
      ).mockResolvedValue(existingAppointment);
      const existsInTrusteePartition =
        mockTrusteeCaseAppointmentsRepo.existsInTrusteePartition as ReturnType<typeof vi.fn>;
      const replaceOneInTrusteePartition =
        mockTrusteeCaseAppointmentsRepo.replaceOneInTrusteePartition as ReturnType<typeof vi.fn>;

      const { successCount } = await SyncTrusteeCaseAppointments.processAppointments(
        SyncTrusteeCaseAppointments.createDeps(context),
        [makeEvent('case-001', 'John Doe')],
      );

      expect(existsInTrusteePartition).toHaveBeenCalledWith(
        'case-001',
        'trustee-123',
        '2024-01-15',
      );
      expect(replaceOneInTrusteePartition).not.toHaveBeenCalled();
      expect(mockTrusteeCaseAppointmentsRepo.upsert).not.toHaveBeenCalled();
      expect(mockTrusteeCaseAppointmentsRepo.updateCaseAppointment).not.toHaveBeenCalled();
      expect(successCount).toBe(1);
    });

    test('repairs trusteePartition when casePartition shows the trustee active but trusteePartition is missing the row', async () => {
      // Simulates the dual-partition-write divergence this fix targets: upsert()/
      // updateCaseAppointment() write casePartition then trusteePartition sequentially and
      // non-transactionally. A transient failure on the trusteePartition write after
      // casePartition already succeeded gets this event requeued as retryable — on retry,
      // getActiveByCaseId (casePartition-only) sees the trustee already active and would
      // silently skip re-attempting the trusteePartition write without this check.
      const existingAppointment: CaseAppointment = {
        id: 'ca-1',
        caseId: 'case-001',
        trusteeId: 'trustee-123',
        assignedOn: '2024-01-15',
        createdOn: '2024-01-01T00:00:00Z',
        createdBy: { id: 'system', name: 'System' },
        updatedOn: '2024-01-01T00:00:00Z',
        updatedBy: { id: 'system', name: 'System' },
      };
      (
        mockTrusteeCaseAppointmentsRepo.getActiveByCaseId as ReturnType<typeof vi.fn>
      ).mockResolvedValue(existingAppointment);
      const existsInTrusteePartition = vi.fn().mockResolvedValue(false);
      mockTrusteeCaseAppointmentsRepo.existsInTrusteePartition = existsInTrusteePartition;
      const replaceOneInTrusteePartition =
        mockTrusteeCaseAppointmentsRepo.replaceOneInTrusteePartition as ReturnType<typeof vi.fn>;
      const errorSpy = vi.spyOn(context.logger, 'error');

      const { successCount } = await SyncTrusteeCaseAppointments.processAppointments(
        SyncTrusteeCaseAppointments.createDeps(context),
        [makeEvent('case-001', 'John Doe')],
      );

      expect(existsInTrusteePartition).toHaveBeenCalledWith(
        'case-001',
        'trustee-123',
        '2024-01-15',
      );
      expect(replaceOneInTrusteePartition).toHaveBeenCalledWith(
        { caseId: 'case-001', trusteeId: 'trustee-123', assignedOn: '2024-01-15' },
        expect.objectContaining({
          ...existingAppointment,
          documentType: 'CASE_APPOINTMENT',
        }),
      );
      expect(errorSpy).toHaveBeenCalledWith(
        'SYNC-TRUSTEE-CASE-APPOINTMENTS-USE-CASE',
        expect.stringContaining('TRUSTEE PARTITION DIVERGENCE'),
      );
      // The event still counts as a success — casePartition was already correct, and the
      // repair is a background-visible correction, not a new business outcome.
      expect(successCount).toBe(1);
      expect(mockTrusteeCaseAppointmentsRepo.upsert).not.toHaveBeenCalled();
      expect(mockTrusteeCaseAppointmentsRepo.updateCaseAppointment).not.toHaveBeenCalled();
    });

    test('repairs a stranded old-trustee trusteePartition row left behind by a failed reassignment retry', async () => {
      // Mirror-direction divergence to the "repairs trusteePartition" test above: a prior
      // reassignment attempt soft-closed the OLD trustee's casePartition row (so
      // getActiveByCaseId now returns null — nothing active in casePartition for this case) but
      // failed transiently on that same old trustee's trusteePartition write, leaving a stranded
      // active row behind. Without this repair, that row would remain permanently active with no
      // telemetry, and the old trustee's case list would incorrectly keep showing this case.
      const strandedRow: CaseAppointment = {
        id: 'ca-old',
        caseId: 'case-001',
        trusteeId: 'trustee-old',
        assignedOn: '2023-06-01',
        createdOn: '2023-06-01T00:00:00Z',
        createdBy: { id: 'system', name: 'System' },
        updatedOn: '2023-06-01T00:00:00Z',
        updatedBy: { id: 'system', name: 'System' },
      };
      const closedCaseRow: CaseAppointment = {
        ...strandedRow,
        unassignedOn: '2024-01-01T00:00:00Z',
      };
      (
        mockTrusteeCaseAppointmentsRepo.getActiveByCaseId as ReturnType<typeof vi.fn>
      ).mockResolvedValue(null);
      (mockTrusteeCaseAppointmentsRepo.getByCaseId as ReturnType<typeof vi.fn>).mockResolvedValue([
        closedCaseRow,
      ]);
      const findStrandedActiveInTrusteePartition = vi.fn().mockResolvedValue(strandedRow);
      mockTrusteeCaseAppointmentsRepo.findStrandedActiveInTrusteePartition =
        findStrandedActiveInTrusteePartition;
      const replaceOneInTrusteePartition =
        mockTrusteeCaseAppointmentsRepo.replaceOneInTrusteePartition as ReturnType<typeof vi.fn>;
      const errorSpy = vi.spyOn(context.logger, 'error');

      const { successCount } = await SyncTrusteeCaseAppointments.processAppointments(
        SyncTrusteeCaseAppointments.createDeps(context),
        [makeEvent('case-001', 'John Doe')],
      );

      expect(findStrandedActiveInTrusteePartition).toHaveBeenCalledWith('case-001', 'trustee-123');
      expect(replaceOneInTrusteePartition).toHaveBeenCalledWith(
        { caseId: 'case-001', trusteeId: 'trustee-old', assignedOn: '2023-06-01' },
        expect.objectContaining({
          ...closedCaseRow,
          documentType: 'CASE_APPOINTMENT',
        }),
      );
      expect(errorSpy).toHaveBeenCalledWith(
        'SYNC-TRUSTEE-CASE-APPOINTMENTS-USE-CASE',
        expect.stringContaining('TRUSTEE PARTITION DIVERGENCE'),
      );
      expect(successCount).toBe(1);
    });

    test('falls back to the stranded row itself when no matching closed row is found in case history', async () => {
      // Same repair path as the test above, but getByCaseId's history has nothing matching this
      // trusteeId/assignedOn pair (e.g. the casePartition row was deleted rather than soft-closed),
      // so the repair must copy the stranded row as-is instead of a closed row's unassignedOn.
      const strandedRow: CaseAppointment = {
        id: 'ca-old',
        caseId: 'case-001',
        trusteeId: 'trustee-old',
        assignedOn: '2023-06-01',
        createdOn: '2023-06-01T00:00:00Z',
        createdBy: { id: 'system', name: 'System' },
        updatedOn: '2023-06-01T00:00:00Z',
        updatedBy: { id: 'system', name: 'System' },
      };
      (
        mockTrusteeCaseAppointmentsRepo.getActiveByCaseId as ReturnType<typeof vi.fn>
      ).mockResolvedValue(null);
      (mockTrusteeCaseAppointmentsRepo.getByCaseId as ReturnType<typeof vi.fn>).mockResolvedValue(
        [],
      );
      const findStrandedActiveInTrusteePartition = vi.fn().mockResolvedValue(strandedRow);
      mockTrusteeCaseAppointmentsRepo.findStrandedActiveInTrusteePartition =
        findStrandedActiveInTrusteePartition;
      const replaceOneInTrusteePartition = vi.fn().mockResolvedValue(undefined);
      mockTrusteeCaseAppointmentsRepo.replaceOneInTrusteePartition = replaceOneInTrusteePartition;

      const { successCount } = await SyncTrusteeCaseAppointments.processAppointments(
        SyncTrusteeCaseAppointments.createDeps(context),
        [makeEvent('case-001', 'John Doe')],
      );

      expect(replaceOneInTrusteePartition).toHaveBeenCalledWith(
        { caseId: 'case-001', trusteeId: 'trustee-old', assignedOn: '2023-06-01' },
        expect.objectContaining({
          ...strandedRow,
          documentType: 'CASE_APPOINTMENT',
        }),
      );
      expect(successCount).toBe(1);
    });

    test('does not repair trusteePartition when no stranded row exists for this case', async () => {
      (
        mockTrusteeCaseAppointmentsRepo.getActiveByCaseId as ReturnType<typeof vi.fn>
      ).mockResolvedValue(null);
      const findStrandedActiveInTrusteePartition = vi.fn().mockResolvedValue(null);
      mockTrusteeCaseAppointmentsRepo.findStrandedActiveInTrusteePartition =
        findStrandedActiveInTrusteePartition;
      const replaceOneInTrusteePartition =
        mockTrusteeCaseAppointmentsRepo.replaceOneInTrusteePartition as ReturnType<typeof vi.fn>;

      await SyncTrusteeCaseAppointments.processAppointments(
        SyncTrusteeCaseAppointments.createDeps(context),
        [makeEvent('case-001', 'John Doe')],
      );

      expect(findStrandedActiveInTrusteePartition).toHaveBeenCalledWith('case-001', 'trustee-123');
      expect(replaceOneInTrusteePartition).not.toHaveBeenCalled();
    });

    describe('a case not yet in CAMS is parked (CASE_APPOINTMENT_UNATTACHED)', () => {
      const parkedEvent = (fullName: string): TrusteeAppointmentSyncEvent => ({
        ...makeEvent('case-001', fullName),
        source: 'ACMS',
        dateFiled: '2026-10-30',
      });

      beforeEach(() => {
        (mockCasesRepo.getCaseOrMovedCase as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      });

      test('a resolved trustee is written as a parked appointment with checks and court fields, with no settle step', async () => {
        const { dlqMessages, successCount, scenarioDistribution } =
          await SyncTrusteeCaseAppointments.processAppointments(
            SyncTrusteeCaseAppointments.createDeps(context),
            [parkedEvent('John Doe')],
          );

        expect(mockTrusteeCaseAppointmentsRepo.upsert).toHaveBeenCalledWith(
          {
            caseId: 'case-001',
            trusteeId: 'trustee-123',
            assignedOn: '2024-01-15',
            appointedDate: '2024-01-15',
            courtId: '081',
            courtDivisionCode: '081',
            chapter: '7',
            dateFiled: '2026-10-30',
            checks: {
              // Stays true while parked: documentType CASE_APPOINTMENT_UNATTACHED is what records
              // that the case is not in CAMS yet.
              matchedCase: true,
              matchedTrustee: true,
              matchedTrusteeAppointment: true,
              matchedBy: 'resolveByPhone',
            },
          },
          'CASE_APPOINTMENT_UNATTACHED',
        );
        expect(mockTrusteeCaseAppointmentsRepo.updateCaseAppointment).not.toHaveBeenCalled();
        expect(mockVariationRepo.createVariation).toHaveBeenCalled();
        expect(dlqMessages).toHaveLength(0);
        expect(successCount).toBe(1);
        expect(scenarioDistribution.parkedCount).toBe(1);
      });

      test('a parked appointment records matchedTrusteeAppointment false when the trustee does not cover the case', async () => {
        (mockAppointmentsRepo.getTrusteeAppointments as ReturnType<typeof vi.fn>).mockResolvedValue(
          [],
        );

        const { scenarioDistribution } = await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          [parkedEvent('John Doe')],
        );

        expect(mockTrusteeCaseAppointmentsRepo.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            trusteeId: 'trustee-123',
            checks: expect.objectContaining({ matchedTrusteeAppointment: false }),
          }),
          'CASE_APPOINTMENT_UNATTACHED',
        );
        expect(scenarioDistribution.autoMatchUncoveredCount).toBe(1);
      });

      test('a disposed row for a parked appointment is written closed on the same natural key', async () => {
        await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          [{ ...parkedEvent('John Doe'), unassignedOn: '2026-11-02' }],
        );

        expect(mockTrusteeCaseAppointmentsRepo.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            caseId: 'case-001',
            trusteeId: 'trustee-123',
            assignedOn: '2024-01-15',
            unassignedOn: '2026-11-02',
          }),
          'CASE_APPOINTMENT_UNATTACHED',
        );
      });

      test('an unknown trustee is parked as a placeholder and the identity task lists the case', async () => {
        (
          pipelineOrchestrator.runTrusteeMatchPipeline as ReturnType<typeof vi.fn>
        ).mockResolvedValueOnce(makeUnresolvedState(0));
        const event = parkedEvent('Ghost Trustee');
        const fingerprint = computeFingerprint(buildVariant(event.sourceTrustee));

        const { scenarioDistribution } = await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          [event],
        );

        expect(mockVerificationRepo.upsertVerification).toHaveBeenCalled();
        expect(mockTrusteeCaseAppointmentsRepo.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            caseId: 'case-001',
            trusteeId: fingerprint,
            isSurrogate: true,
            dateFiled: '2026-10-30',
          }),
          'CASE_APPOINTMENT_UNATTACHED',
        );
        expect(scenarioDistribution.noMatchCount).toBe(1);
        expect(scenarioDistribution.parkedCount).toBe(1);
      });

      test('a row joining a pending identity task is parked as a placeholder', async () => {
        const event = parkedEvent('Ghost Trustee');
        const variant = buildVariant(event.sourceTrustee);
        const fingerprint = computeFingerprint(variant);
        (mockVerificationRepo.findByFingerprint as ReturnType<typeof vi.fn>).mockResolvedValue([
          { documentType: 'TRUSTEE_MATCH_VERIFICATION', fingerprint, variant, status: 'pending' },
        ]);

        const { scenarioDistribution } = await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          [event],
        );

        expect(mockTrusteeCaseAppointmentsRepo.upsert).toHaveBeenCalledWith(
          expect.objectContaining({ trusteeId: fingerprint, isSurrogate: true }),
          'CASE_APPOINTMENT_UNATTACHED',
        );
        expect(scenarioDistribution.verificationBucketHitCount).toBe(1);
        expect(scenarioDistribution.parkedCount).toBe(1);
      });

      test('a bogus-trustee row has nothing to close and writes nothing', async () => {
        const { dlqMessages } = await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          [
            {
              ...parkedEvent(''),
              sourceTrustee: { fullName: 'No Trustee', lastName: 'No Trustee' },
              profCode: '00000',
            },
          ],
        );

        expect(mockTrusteeCaseAppointmentsRepo.getActiveByCaseId).not.toHaveBeenCalled();
        expect(mockTrusteeCaseAppointmentsRepo.upsert).not.toHaveBeenCalled();
        expect(dlqMessages).toHaveLength(0);
      });

      test.each([
        ['a resolved trustee', () => makeResolvedState('trustee-123')],
        ['an unknown trustee (placeholder)', () => makeUnresolvedState(0)],
      ])(
        'a parked write for %s without dateFiled is dead-lettered, never parked',
        async (_label, state) => {
          (
            pipelineOrchestrator.runTrusteeMatchPipeline as ReturnType<typeof vi.fn>
          ).mockResolvedValueOnce(state());

          const { dlqMessages, scenarioDistribution } =
            await SyncTrusteeCaseAppointments.processAppointments(
              SyncTrusteeCaseAppointments.createDeps(context),
              [{ ...parkedEvent('John Doe'), dateFiled: undefined }],
            );

          expect(mockTrusteeCaseAppointmentsRepo.upsert).not.toHaveBeenCalled();
          expect(dlqMessages).toEqual([
            expect.objectContaining({
              error: expect.objectContaining({
                message: expect.stringContaining('no dateFiled'),
              }),
            }),
          ]);
          expect(scenarioDistribution.parkedCount).toBe(0);
        },
      );
    });

    test('should skip and not error when getCaseOrMovedCase returns a transferred case', async () => {
      (mockCasesRepo.getCaseOrMovedCase as ReturnType<typeof vi.fn>).mockResolvedValue({
        caseId: 'case-001',
        movedToCaseId: 'case-999',
        courtId: '081',
        courtDivisionCode: '081',
        chapter: '7',
      });

      const events = [makeEvent('case-001', 'John Doe')];
      const { dlqMessages, successCount, scenarioDistribution } =
        await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          events,
        );

      expect(dlqMessages).toHaveLength(0);
      expect(scenarioDistribution.parkedCount).toBe(0);
      expect(successCount).toBe(0);
      expect(mockTrusteeCaseAppointmentsRepo.upsert).not.toHaveBeenCalled();
      expect(mockVerificationRepo.upsertVerification).not.toHaveBeenCalled();
    });

    test('should pass appointedDate from event to createCaseAppointment', async () => {
      const events: TrusteeAppointmentSyncEvent[] = [
        { ...makeEvent('case-001', 'John Doe'), appointedDate: '2026-04-07' },
      ];

      await SyncTrusteeCaseAppointments.processAppointments(
        SyncTrusteeCaseAppointments.createDeps(context),
        events,
      );

      expect(mockTrusteeCaseAppointmentsRepo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          caseId: 'case-001',
          trusteeId: 'trustee-123',
          appointedDate: '2026-04-07',
        }),
      );
    });

    test('falls back to name matching when there is no professional ID', async () => {
      const events = [makeEvent('case-001', 'John Doe')];

      await SyncTrusteeCaseAppointments.processAppointments(
        SyncTrusteeCaseAppointments.createDeps(context),
        events,
      );

      expect(pipelineOrchestrator.runTrusteeMatchPipeline).toHaveBeenCalledWith(context, {
        fullName: 'John Doe',
        firstName: 'John',
        lastName: 'Doe',
      });
    });

    describe('unappointable chapter', () => {
      test.each([['9'], ['15']])(
        'skips matching and verification entirely for a chapter %s case, regardless of a usable name',
        async (chapter) => {
          const events: TrusteeAppointmentSyncEvent[] = [
            { ...makeEvent('case-001', 'John Doe'), chapter },
          ];

          const { successCount, dlqMessages, scenarioDistribution } =
            await SyncTrusteeCaseAppointments.processAppointments(
              SyncTrusteeCaseAppointments.createDeps(context),
              events,
            );

          expect(pipelineOrchestrator.runTrusteeMatchPipeline).not.toHaveBeenCalled();
          expect(mockVerificationRepo.getVerification).not.toHaveBeenCalled();
          expect(mockVerificationRepo.upsertVerification).not.toHaveBeenCalled();
          expect(mockCasesRepo.getCaseOrMovedCase).not.toHaveBeenCalled();
          expect(mockTrusteeCaseAppointmentsRepo.upsert).not.toHaveBeenCalled();

          expect(successCount).toBe(0);
          expect(dlqMessages).toHaveLength(0);
          expect(scenarioDistribution.unappointableChapterSkippedCount).toBe(1);
        },
      );

      test('does not skip a normal chapter 11 case', async () => {
        const events = [{ ...makeEvent('case-001', 'John Doe'), chapter: '11' }];

        const { scenarioDistribution } = await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          events,
        );

        expect(pipelineOrchestrator.runTrusteeMatchPipeline).toHaveBeenCalled();
        expect(scenarioDistribution.unappointableChapterSkippedCount).toBe(0);
      });
    });

    describe('empty demographics', () => {
      test('skips matching and verification entirely when fullName and all legacy/contact fields are blank', async () => {
        const events: TrusteeAppointmentSyncEvent[] = [
          {
            ...makeEvent('case-001', ''),
            sourceTrustee: { fullName: '' },
          },
        ];

        const { successCount, dlqMessages, scenarioDistribution } =
          await SyncTrusteeCaseAppointments.processAppointments(
            SyncTrusteeCaseAppointments.createDeps(context),
            events,
          );

        expect(pipelineOrchestrator.runTrusteeMatchPipeline).not.toHaveBeenCalled();
        expect(mockVerificationRepo.getVerification).not.toHaveBeenCalled();
        expect(mockVerificationRepo.upsertVerification).not.toHaveBeenCalled();
        expect(mockCasesRepo.getCaseOrMovedCase).not.toHaveBeenCalled();
        expect(mockTrusteeCaseAppointmentsRepo.upsert).not.toHaveBeenCalled();

        expect(successCount).toBe(0);
        expect(dlqMessages).toHaveLength(0);
        expect(scenarioDistribution.emptyDemographicsSkippedCount).toBe(1);
      });

      test('treats a whitespace-only fullName the same as blank', async () => {
        const events: TrusteeAppointmentSyncEvent[] = [
          {
            ...makeEvent('case-001', ''),
            sourceTrustee: { fullName: '   ' },
          },
        ];

        const { scenarioDistribution } = await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          events,
        );

        expect(pipelineOrchestrator.runTrusteeMatchPipeline).not.toHaveBeenCalled();
        expect(scenarioDistribution.emptyDemographicsSkippedCount).toBe(1);
      });

      test('still proceeds to matching when fullName is blank but legacy contact fields are present', async () => {
        const events: TrusteeAppointmentSyncEvent[] = [
          {
            ...makeEvent('case-001', ''),
            sourceTrustee: { fullName: '', legacy: { address1: '123 Main St' } },
          },
        ];

        const { scenarioDistribution } = await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          events,
        );

        expect(pipelineOrchestrator.runTrusteeMatchPipeline).toHaveBeenCalledWith(context, {
          fullName: '',
          legacy: { address1: '123 Main St' },
        });
        expect(scenarioDistribution.emptyDemographicsSkippedCount).toBe(0);
      });

      test('does not skip a normal event with a usable name', async () => {
        const events = [makeEvent('case-001', 'John Doe')];

        const { scenarioDistribution } = await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          events,
        );

        expect(scenarioDistribution.emptyDemographicsSkippedCount).toBe(0);
      });
    });

    describe('sentinel professional code', () => {
      test.each([['00000'], ['99999']])(
        'skips an event with profCode %s and no name/address at all',
        async (profCode) => {
          const events: TrusteeAppointmentSyncEvent[] = [
            { ...makeEvent('case-001', ''), sourceTrustee: { fullName: '' }, profCode },
          ];

          const { scenarioDistribution } = await SyncTrusteeCaseAppointments.processAppointments(
            SyncTrusteeCaseAppointments.createDeps(context),
            events,
          );

          expect(pipelineOrchestrator.runTrusteeMatchPipeline).not.toHaveBeenCalled();
          expect(mockVerificationRepo.upsertVerification).not.toHaveBeenCalled();
          expect(scenarioDistribution.emptyDemographicsSkippedCount).toBe(1);
        },
      );

      test.each([['00000'], ['99999']])(
        // Regression: isBogusTrusteeName's lastName-then-fullName fallback must use
        // normalizeName (not plain truthiness) — a whitespace-only lastName is truthy in JS and
        // would otherwise suppress the fallback to fullName, hiding a genuine name.
        'falls back to fullName when lastName is whitespace-only, with profCode %s',
        async (profCode) => {
          const events: TrusteeAppointmentSyncEvent[] = [
            {
              ...makeEvent('case-001', 'Jane Trustee Services'),
              sourceTrustee: {
                fullName: 'Jane Trustee Services',
                lastName: '   ',
              },
              profCode,
            },
          ];

          const { scenarioDistribution } = await SyncTrusteeCaseAppointments.processAppointments(
            SyncTrusteeCaseAppointments.createDeps(context),
            events,
          );

          // lastName is blank, so isBogusTrusteeName falls back to fullName — which contains
          // "trustee" — and no contact info is present, so this is correctly skipped.
          expect(pipelineOrchestrator.runTrusteeMatchPipeline).not.toHaveBeenCalled();
          expect(scenarioDistribution.sentinelBogusNameSkippedCount).toBe(1);
        },
      );

      test.each([
        ['00000', 'No Trustee'],
        ['99999', 'No Trustee'],
        ['00000', 'TRUSTEE NOT APPOINTED'],
        ['00000', 'Awaiting Trustee Assignment'],
        ['00000', 'Not Assigned - XX'],
        ['00000', 'For Internal Use Only'],
        ['00000', 'CHAPTER 11 - XX'],
      ])(
        'skips an event with profCode %s and bogus name %s when no contact fields are populated',
        async (profCode, bogusName) => {
          const events: TrusteeAppointmentSyncEvent[] = [
            {
              ...makeEvent('case-001', ''),
              sourceTrustee: { fullName: bogusName, lastName: bogusName },
              profCode,
            },
          ];

          const { scenarioDistribution } = await SyncTrusteeCaseAppointments.processAppointments(
            SyncTrusteeCaseAppointments.createDeps(context),
            events,
          );

          expect(pipelineOrchestrator.runTrusteeMatchPipeline).not.toHaveBeenCalled();
          expect(mockVerificationRepo.upsertVerification).not.toHaveBeenCalled();
          expect(scenarioDistribution.sentinelBogusNameSkippedCount).toBe(1);
        },
      );

      test.each([['00000'], ['99999']])(
        // isBogusTrusteeName must never disqualify a record that also carries real contact
        // info — otherwise a genuine trustee named e.g. "John Doe, Trustee" or a firm "ABC
        // Chapter 13 Services" with a sentinel profCode and a real address/phone/email would be
        // silently dropped before ever reaching matching.
        'does not skip an event with profCode %s and a bogus-looking name when contact fields are populated',
        async (profCode) => {
          const events: TrusteeAppointmentSyncEvent[] = [
            {
              ...makeEvent('case-001', ''),
              sourceTrustee: {
                fullName: 'John Doe, Trustee',
                lastName: 'Doe, Trustee',
                legacy: {
                  address1: '123 Fake St',
                  phone: '555-555-5555',
                  email: 'fake@example.com',
                },
              },
              profCode,
            },
          ];

          const { scenarioDistribution } = await SyncTrusteeCaseAppointments.processAppointments(
            SyncTrusteeCaseAppointments.createDeps(context),
            events,
          );

          expect(pipelineOrchestrator.runTrusteeMatchPipeline).toHaveBeenCalled();
          expect(scenarioDistribution.emptyDemographicsSkippedCount).toBe(0);
          expect(scenarioDistribution.sentinelBogusNameSkippedCount).toBe(0);
        },
      );

      test.each([['00000'], ['99999']])(
        'does not skip an event with profCode %s and a genuine name but no contact fields',
        async (profCode) => {
          const events: TrusteeAppointmentSyncEvent[] = [
            { ...makeEvent('case-001', 'Jane A Example'), profCode },
          ];

          const { scenarioDistribution } = await SyncTrusteeCaseAppointments.processAppointments(
            SyncTrusteeCaseAppointments.createDeps(context),
            events,
          );

          expect(pipelineOrchestrator.runTrusteeMatchPipeline).toHaveBeenCalled();
          expect(scenarioDistribution.emptyDemographicsSkippedCount).toBe(0);
        },
      );

      test.each([['00000'], ['99999']])(
        'does not skip an event with profCode %s and a genuine name and address',
        async (profCode) => {
          const events: TrusteeAppointmentSyncEvent[] = [
            {
              ...makeEvent('case-001', 'Jane A Example'),
              sourceTrustee: {
                fullName: 'Jane A Example',
                firstName: 'Jane',
                lastName: 'Example',
                legacy: { address1: '123 Fake St' },
              },
              profCode,
            },
          ];

          const { scenarioDistribution } = await SyncTrusteeCaseAppointments.processAppointments(
            SyncTrusteeCaseAppointments.createDeps(context),
            events,
          );

          expect(pipelineOrchestrator.runTrusteeMatchPipeline).toHaveBeenCalled();
          expect(scenarioDistribution.emptyDemographicsSkippedCount).toBe(0);
        },
      );

      test.each([['00000'], ['99999']])(
        // Regression (mattstankey review): isSentinelWithNoIdentity's contact check must
        // recognize phone/email the same way hasNoUsableDemographics's hasContact does — an
        // address-only check would wrongly conclude "no contact" for a record with only a
        // phone or email, which is exactly the kind of legitimate contact signal the outer
        // check already treats as usable.
        'does not skip an event with profCode %s, blank name/address, but a populated phone',
        async (profCode) => {
          const events: TrusteeAppointmentSyncEvent[] = [
            {
              ...makeEvent('case-001', ''),
              sourceTrustee: { fullName: '', legacy: { phone: '555-555-5555' } },
              profCode,
            },
          ];

          const { scenarioDistribution } = await SyncTrusteeCaseAppointments.processAppointments(
            SyncTrusteeCaseAppointments.createDeps(context),
            events,
          );

          expect(pipelineOrchestrator.runTrusteeMatchPipeline).toHaveBeenCalled();
          expect(scenarioDistribution.emptyDemographicsSkippedCount).toBe(0);
        },
      );

      test.each([['00000'], ['99999']])(
        'does not skip an event with profCode %s, blank name/address, but a populated email',
        async (profCode) => {
          const events: TrusteeAppointmentSyncEvent[] = [
            {
              ...makeEvent('case-001', ''),
              sourceTrustee: { fullName: '', legacy: { email: 'fake@example.com' } },
              profCode,
            },
          ];

          const { scenarioDistribution } = await SyncTrusteeCaseAppointments.processAppointments(
            SyncTrusteeCaseAppointments.createDeps(context),
            events,
          );

          expect(pipelineOrchestrator.runTrusteeMatchPipeline).toHaveBeenCalled();
          expect(scenarioDistribution.emptyDemographicsSkippedCount).toBe(0);
        },
      );

      test.each([['00000'], ['99999']])(
        'does not skip an event with profCode %s and a genuine fullName but no separate firstName field',
        async (profCode) => {
          // Regression: isSentinelWithNoIdentity's no-name check must recognize a usable
          // fullName the same way hasNoUsableDemographics does, even when DXTR supplies no
          // separate firstName field — a firstName-only check would wrongly conclude "no name"
          // for a record hasNoUsableDemographics itself already treated as named.
          const events: TrusteeAppointmentSyncEvent[] = [
            {
              ...makeEvent('case-001', 'Jane A Example'),
              sourceTrustee: { fullName: 'Jane A Example' },
              profCode,
            },
          ];

          const { scenarioDistribution } = await SyncTrusteeCaseAppointments.processAppointments(
            SyncTrusteeCaseAppointments.createDeps(context),
            events,
          );

          expect(pipelineOrchestrator.runTrusteeMatchPipeline).toHaveBeenCalled();
          expect(scenarioDistribution.emptyDemographicsSkippedCount).toBe(0);
        },
      );

      test('a non-sentinel profCode still hits the pre-existing empty-demographics rule, even with no name/address', async () => {
        const events: TrusteeAppointmentSyncEvent[] = [
          {
            ...makeEvent('case-001', ''),
            sourceTrustee: { fullName: '' },
            profCode: '12345',
          },
        ];

        const { scenarioDistribution } = await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          events,
        );

        // Unaffected by the sentinel rule — falls through to the existing empty-demographics
        // rule, which still applies regardless of profCode.
        expect(scenarioDistribution.emptyDemographicsSkippedCount).toBe(1);
      });

      test('does not treat a real trustee name containing "trustee" as bogus when profCode is not a sentinel', async () => {
        const events: TrusteeAppointmentSyncEvent[] = [
          {
            ...makeEvent('case-001', 'Jane A Example'),
            sourceTrustee: {
              fullName: 'Jane A Robert Trustee',
              firstName: 'Jane',
              lastName: 'Robert Trustee',
            },
            profCode: '12345',
          },
        ];

        const { scenarioDistribution } = await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          events,
        );

        expect(pipelineOrchestrator.runTrusteeMatchPipeline).toHaveBeenCalled();
        expect(scenarioDistribution.emptyDemographicsSkippedCount).toBe(0);
      });

      test.each([['00000'], ['99999']])(
        // Exercises isBogusTrusteeName directly with a sentinel profCode, a name containing a
        // bogus-name keyword, AND real contact info — the exact combination the sentinel-skip
        // rule above must never treat as disqualifying.
        'does not skip a genuinely-named trustee whose name contains "trustee" with profCode %s and real contact info',
        async (profCode) => {
          const events: TrusteeAppointmentSyncEvent[] = [
            {
              ...makeEvent('case-001', 'Robert Trustee'),
              sourceTrustee: {
                fullName: 'Robert Trustee',
                firstName: 'Robert',
                lastName: 'Trustee',
                legacy: {
                  address1: '123 Fake St',
                  phone: '555-555-5555',
                  email: 'fake@example.com',
                },
              },
              profCode,
            },
          ];

          const { scenarioDistribution } = await SyncTrusteeCaseAppointments.processAppointments(
            SyncTrusteeCaseAppointments.createDeps(context),
            events,
          );

          expect(pipelineOrchestrator.runTrusteeMatchPipeline).toHaveBeenCalled();
          expect(scenarioDistribution.emptyDemographicsSkippedCount).toBe(0);
          expect(scenarioDistribution.sentinelBogusNameSkippedCount).toBe(0);
        },
      );

      describe('close-only for bogus/placeholder trustees', () => {
        const existingAppointment: CaseAppointment = {
          id: 'ca-old',
          caseId: 'case-001',
          trusteeId: 'old-trustee',
          assignedOn: '2024-01-01',
          createdOn: '2024-01-01T00:00:00Z',
          createdBy: { id: 'system', name: 'System' },
          updatedOn: '2024-01-01T00:00:00Z',
          updatedBy: { id: 'system', name: 'System' },
        };

        test('closes the existing active appointment without creating a replacement when the event has a bogus placeholder name', async () => {
          (
            mockTrusteeCaseAppointmentsRepo.getActiveByCaseId as ReturnType<typeof vi.fn>
          ).mockResolvedValue(existingAppointment);

          const events: TrusteeAppointmentSyncEvent[] = [
            {
              ...makeEvent('case-001', ''),
              sourceTrustee: { fullName: 'No Trustee', lastName: 'No Trustee' },
              profCode: '00000',
            },
          ];

          const { scenarioDistribution } = await SyncTrusteeCaseAppointments.processAppointments(
            SyncTrusteeCaseAppointments.createDeps(context),
            events,
          );

          // makeEvent's appointedDate is '2024-01-15' — unassignedOn is one day before it, never
          // wall-clock time.
          expect(mockTrusteeCaseAppointmentsRepo.updateCaseAppointment).toHaveBeenCalledWith(
            expect.objectContaining({
              id: 'ca-old',
              trusteeId: 'old-trustee',
              unassignedOn: '2024-01-14',
            }),
          );
          expect(mockTrusteeCaseAppointmentsRepo.upsert).not.toHaveBeenCalled();
          expect(scenarioDistribution.sentinelBogusNameSkippedCount).toBe(1);
        });

        test('closes at the bogus event disposition as given when the source carries one', async () => {
          (
            mockTrusteeCaseAppointmentsRepo.getActiveByCaseId as ReturnType<typeof vi.fn>
          ).mockResolvedValue(existingAppointment);

          const events: TrusteeAppointmentSyncEvent[] = [
            {
              ...makeEvent('case-001', ''),
              sourceTrustee: { fullName: 'No Trustee', lastName: 'No Trustee' },
              profCode: '00000',
              unassignedOn: '2024-03-01',
            },
          ];

          await SyncTrusteeCaseAppointments.processAppointments(
            SyncTrusteeCaseAppointments.createDeps(context),
            events,
          );

          expect(mockTrusteeCaseAppointmentsRepo.updateCaseAppointment).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'ca-old', unassignedOn: '2024-03-01' }),
          );
          expect(mockTrusteeCaseAppointmentsRepo.upsert).not.toHaveBeenCalled();
        });

        test('leaves a newer active appointment untouched when the bogus event is older than it', async () => {
          (
            mockTrusteeCaseAppointmentsRepo.getActiveByCaseId as ReturnType<typeof vi.fn>
          ).mockResolvedValue(existingAppointment);

          // existingAppointment starts 2024-01-01; this bogus record is from an earlier court order.
          const events: TrusteeAppointmentSyncEvent[] = [
            {
              ...makeEvent('case-001', ''),
              appointedDate: '2023-12-01',
              sourceTrustee: { fullName: 'No Trustee', lastName: 'No Trustee' },
              profCode: '00000',
            },
          ];

          await SyncTrusteeCaseAppointments.processAppointments(
            SyncTrusteeCaseAppointments.createDeps(context),
            events,
          );

          expect(mockTrusteeCaseAppointmentsRepo.updateCaseAppointment).not.toHaveBeenCalled();
          expect(mockTrusteeCaseAppointmentsRepo.upsert).not.toHaveBeenCalled();
        });

        test('does nothing further when there is no existing active appointment to close', async () => {
          // getActiveByCaseId defaults to null in beforeEach — nothing to close.
          const events: TrusteeAppointmentSyncEvent[] = [
            {
              ...makeEvent('case-001', ''),
              sourceTrustee: { fullName: 'No Trustee', lastName: 'No Trustee' },
              profCode: '00000',
            },
          ];

          const { scenarioDistribution } = await SyncTrusteeCaseAppointments.processAppointments(
            SyncTrusteeCaseAppointments.createDeps(context),
            events,
          );

          expect(mockTrusteeCaseAppointmentsRepo.updateCaseAppointment).not.toHaveBeenCalled();
          expect(mockTrusteeCaseAppointmentsRepo.upsert).not.toHaveBeenCalled();
          expect(scenarioDistribution.sentinelBogusNameSkippedCount).toBe(1);
        });

        test('routes to retryableEvents and creates nothing on a transient close failure', async () => {
          (
            mockTrusteeCaseAppointmentsRepo.getActiveByCaseId as ReturnType<typeof vi.fn>
          ).mockResolvedValue(existingAppointment);
          (
            mockTrusteeCaseAppointmentsRepo.updateCaseAppointment as ReturnType<typeof vi.fn>
          ).mockRejectedValue(new TooManyRequestsError('COSMOS'));

          const events: TrusteeAppointmentSyncEvent[] = [
            {
              ...makeEvent('case-001', ''),
              sourceTrustee: { fullName: 'No Trustee', lastName: 'No Trustee' },
              profCode: '00000',
            },
          ];

          const { retryableEvents, dlqMessages, scenarioDistribution } =
            await SyncTrusteeCaseAppointments.processAppointments(
              SyncTrusteeCaseAppointments.createDeps(context),
              events,
            );

          expect(retryableEvents).toHaveLength(1);
          expect(dlqMessages).toHaveLength(0);
          expect(mockTrusteeCaseAppointmentsRepo.upsert).not.toHaveBeenCalled();
          // The event never reached a terminal skip outcome — it's being retried, not counted.
          expect(scenarioDistribution.sentinelBogusNameSkippedCount).toBe(0);
        });

        test('logs the failure and reports the event as handled on a permanent close failure', async () => {
          (
            mockTrusteeCaseAppointmentsRepo.getActiveByCaseId as ReturnType<typeof vi.fn>
          ).mockResolvedValue(existingAppointment);
          (
            mockTrusteeCaseAppointmentsRepo.updateCaseAppointment as ReturnType<typeof vi.fn>
          ).mockRejectedValue(new Error('Cosmos write failed'));

          const events: TrusteeAppointmentSyncEvent[] = [
            {
              ...makeEvent('case-001', ''),
              sourceTrustee: { fullName: 'No Trustee', lastName: 'No Trustee' },
              profCode: '00000',
            },
          ];

          const { retryableEvents, dlqMessages, scenarioDistribution } =
            await SyncTrusteeCaseAppointments.processAppointments(
              SyncTrusteeCaseAppointments.createDeps(context),
              events,
            );

          expect(retryableEvents).toHaveLength(0);
          expect(dlqMessages).toHaveLength(0);
          expect(mockTrusteeCaseAppointmentsRepo.upsert).not.toHaveBeenCalled();
          expect(scenarioDistribution.sentinelBogusNameSkippedCount).toBe(1);
        });

        test('routes to dlqMessages and closes nothing when appointedDate is missing', async () => {
          (
            mockTrusteeCaseAppointmentsRepo.getActiveByCaseId as ReturnType<typeof vi.fn>
          ).mockResolvedValue(existingAppointment);

          const events: TrusteeAppointmentSyncEvent[] = [
            {
              ...makeEvent('case-001', ''),
              sourceTrustee: { fullName: 'No Trustee', lastName: 'No Trustee' },
              profCode: '00000',
              appointedDate: undefined,
            },
          ];

          const { retryableEvents, dlqMessages, scenarioDistribution } =
            await SyncTrusteeCaseAppointments.processAppointments(
              SyncTrusteeCaseAppointments.createDeps(context),
              events,
            );

          expect(retryableEvents).toHaveLength(0);
          expect(dlqMessages).toHaveLength(1);
          expect(mockTrusteeCaseAppointmentsRepo.updateCaseAppointment).not.toHaveBeenCalled();
          expect(mockTrusteeCaseAppointmentsRepo.upsert).not.toHaveBeenCalled();
          // Never reached a terminal skip outcome — it's a data-integrity DLQ, not counted.
          expect(scenarioDistribution.sentinelBogusNameSkippedCount).toBe(0);
        });
      });
    });

    describe('bogus administrative name with no firstName', () => {
      // Real DXTR noise observed in production: administrative/court-office placeholders with a
      // non-sentinel profCode AND real contact info (a court or USTP-office address/phone/email),
      // so neither the empty-demographics rule nor the sentinel-profCode bogus-name rule catches
      // them. Every observed instance has no separate firstName field — the entire label lives in
      // lastName/fullName — unlike a genuine trustee record, which always has one.
      test.each([
        ['For Internal Use Only', { email: 'bnc@mdb.uscourts.gov' }],
        [
          'US Trustee 11',
          {
            address1: '515 Rusk Ave',
            cityStateZipCountry: 'Houston TX 77002 USA',
            phone: '713-718-4650',
            email: 'USTPRegion07.HU.ECF@USDOJ.GOV',
          },
        ],
        ['Awaiting Trustee Assignment', { cityStateZipCountry: 'NJ' }],
        [
          'CHAPTER 11 - LV',
          {
            address1: '300 LAS VEGAS BLVD., SO. #4300',
            cityStateZipCountry: 'LAS VEGAS NV 89101',
            phone: '(702) 388-6600',
            email: 'USTPRegion17.lv.ecf@usdoj.gov',
          },
        ],
      ])(
        'skips bogus admin name %s with a non-sentinel profCode and real contact info',
        async (bogusName, legacy) => {
          const events: TrusteeAppointmentSyncEvent[] = [
            {
              ...makeEvent('case-001', bogusName),
              sourceTrustee: { fullName: bogusName, lastName: bogusName, legacy },
              profCode: '12345',
            },
          ];

          const { scenarioDistribution } = await SyncTrusteeCaseAppointments.processAppointments(
            SyncTrusteeCaseAppointments.createDeps(context),
            events,
          );

          expect(pipelineOrchestrator.runTrusteeMatchPipeline).not.toHaveBeenCalled();
          expect(mockVerificationRepo.upsertVerification).not.toHaveBeenCalled();
          expect(scenarioDistribution.unattributableBogusNameSkippedCount).toBe(1);
        },
      );

      test('does not skip a genuine trustee whose name contains a bogus keyword but has a firstName', async () => {
        const events: TrusteeAppointmentSyncEvent[] = [
          {
            ...makeEvent('case-001', 'Robert E Eggmann III'),
            sourceTrustee: {
              fullName: 'Robert E Eggmann III',
              firstName: 'Robert',
              lastName: 'Eggmann',
              legacy: {
                address1: 'PO Box 168',
                cityStateZipCountry: 'Columbia IL 62236 USA',
                phone: '618-222-1900',
                email: 'reetrustee@carmodymacdonald.com',
              },
            },
            profCode: '12345',
          },
        ];

        const { scenarioDistribution } = await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          events,
        );

        expect(pipelineOrchestrator.runTrusteeMatchPipeline).toHaveBeenCalled();
        expect(scenarioDistribution.unattributableBogusNameSkippedCount).toBe(0);
      });

      test('does not skip a bogus-looking name that also has a firstName', async () => {
        const events: TrusteeAppointmentSyncEvent[] = [
          {
            ...makeEvent('case-001', 'Robert Trustee'),
            sourceTrustee: {
              fullName: 'Robert Trustee',
              firstName: 'Robert',
              lastName: 'Trustee',
            },
            profCode: '12345',
          },
        ];

        const { scenarioDistribution } = await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          events,
        );

        expect(pipelineOrchestrator.runTrusteeMatchPipeline).toHaveBeenCalled();
        expect(scenarioDistribution.unattributableBogusNameSkippedCount).toBe(0);
      });
    });

    describe('bogus administrative name on a chapter 11 case', () => {
      // Chapter 11 cases don't typically have a trustee appointed at filing (one may be
      // appointed later as the case proceeds), so a bogus/administrative-looking name on a
      // chapter 11 event is corroborated by the chapter itself — the firstName requirement is
      // relaxed here, unlike the general unattributable-bogus-name rule above.
      test('skips a bogus-looking name with a firstName when chapter is 11', async () => {
        const events: TrusteeAppointmentSyncEvent[] = [
          {
            ...makeEvent('case-001', 'Robert Trustee'),
            sourceTrustee: {
              fullName: 'Robert Trustee',
              firstName: 'Robert',
              lastName: 'Trustee',
            },
            profCode: '12345',
            chapter: '11',
          },
        ];

        const { scenarioDistribution } = await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          events,
        );

        expect(pipelineOrchestrator.runTrusteeMatchPipeline).not.toHaveBeenCalled();
        expect(scenarioDistribution.unattributableBogusNameSkippedCount).toBe(1);
      });

      test('does not skip a genuine chapter 11 trustee whose name has no bogus keyword', async () => {
        const events: TrusteeAppointmentSyncEvent[] = [
          {
            ...makeEvent('case-001', 'Jane A Example'),
            sourceTrustee: {
              fullName: 'Jane A Example',
              firstName: 'Jane',
              lastName: 'Example',
            },
            profCode: '12345',
            chapter: '11',
          },
        ];

        const { scenarioDistribution } = await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          events,
        );

        expect(pipelineOrchestrator.runTrusteeMatchPipeline).toHaveBeenCalled();
        expect(scenarioDistribution.unattributableBogusNameSkippedCount).toBe(0);
      });

      // The chapter-11 branch is unconditional on profCode and contact info, unlike
      // isSentinelWithNoIdentity's sentinel-profCode rule.
      test('skips a bogus-looking name on a chapter 11 case with a sentinel profCode and real contact info', async () => {
        const events: TrusteeAppointmentSyncEvent[] = [
          {
            ...makeEvent('case-001', 'CHAPTER 11 - LV'),
            sourceTrustee: {
              fullName: 'CHAPTER 11 - LV',
              lastName: 'CHAPTER 11 - LV',
              legacy: {
                address1: '300 LAS VEGAS BLVD., SO. #4300',
                cityStateZipCountry: 'LAS VEGAS NV 89101',
                phone: '(702) 388-6600',
                email: 'USTPRegion17.lv.ecf@usdoj.gov',
              },
            },
            profCode: '00000',
            chapter: '11',
          },
        ];

        const { scenarioDistribution } = await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          events,
        );

        expect(pipelineOrchestrator.runTrusteeMatchPipeline).not.toHaveBeenCalled();
        expect(scenarioDistribution.unattributableBogusNameSkippedCount).toBe(1);
      });

      // resolveSkipReason checks isSentinelWithNoIdentity before isUnattributableBogusName, so a
      // sentinel profCode wins ties and increments sentinelBogusNameSkippedCount, not
      // unattributableBogusNameSkippedCount.
      test('attributes a chapter 11, sentinel-profCode, no-contact bogus name to the sentinel rule, not unattributableBogusNameSkippedCount', async () => {
        const events: TrusteeAppointmentSyncEvent[] = [
          {
            ...makeEvent('case-001', 'CHAPTER 11 - LV'),
            sourceTrustee: { fullName: 'CHAPTER 11 - LV', lastName: 'CHAPTER 11 - LV' },
            profCode: '00000',
            chapter: '11',
          },
        ];

        const { scenarioDistribution } = await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          events,
        );

        expect(pipelineOrchestrator.runTrusteeMatchPipeline).not.toHaveBeenCalled();
        expect(scenarioDistribution.sentinelBogusNameSkippedCount).toBe(1);
        expect(scenarioDistribution.unattributableBogusNameSkippedCount).toBe(0);
      });
    });

    describe('bogus-looking name with no contact info, but a populated firstName token', () => {
      // "No Trustee" is real DXTR noise (see production backtest), but DXTR's naive whitespace
      // split parses "No" out as a firstName token — indistinguishable in shape from "Ghost
      // Trustee"/"Known Trustee", which are ordinary NO_TRUSTEE_MATCH name-matching fixtures used
      // elsewhere in this suite (real names, for testing purposes, not administrative
      // placeholders). Telling "No" apart from "Ghost" as a first-name token would require a real
      // name dictionary, out of scope here — deliberately proceeds to matching rather than risk
      // silently dropping a genuine no-match event that happens to share this shape.
      test('proceeds to matching for a bogus-keyword name with a firstName and no contact info', async () => {
        const events: TrusteeAppointmentSyncEvent[] = [
          {
            ...makeEvent('case-001', 'No Trustee'),
            sourceTrustee: {
              fullName: 'No Trustee',
              firstName: 'No',
              lastName: 'Trustee',
              legacy: {},
            },
            profCode: '12345',
          },
        ];

        const { scenarioDistribution } = await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          events,
        );

        expect(pipelineOrchestrator.runTrusteeMatchPipeline).toHaveBeenCalled();
        expect(scenarioDistribution.unattributableBogusNameSkippedCount).toBe(0);
      });
    });

    describe('defensive fullName fallback when dxtrTrustee.fullName is missing', () => {
      // No producer sends dxtrTrustee.fullName as null/undefined today (the type requires a
      // string); this stands in for malformed legacy data defensively guarded against by the
      // `dxtrTrustee.fullName ?? ''` fallback in resolveSkipReason, isSentinelWithNoIdentity, and
      // isBogusTrusteeName alike. A sentinel profCode plus usable contact info routes through
      // isSentinelWithNoIdentity (reached here, since contact info short-circuits it to false
      // before it can disqualify the event) on the way to the same fallback in
      // isUnattributableBogusName.
      test('treats a missing fullName as an empty name rather than throwing', async () => {
        const events = [
          {
            ...makeEvent('case-001', 'Ignored'),
            dxtrTrustee: {
              fullName: undefined,
              lastName: undefined,
              legacy: { phone: '555-123-4567' },
            },
            profCode: '00000',
          },
        ] as unknown as TrusteeAppointmentSyncEvent[];

        const { scenarioDistribution } = await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          events,
        );

        expect(pipelineOrchestrator.runTrusteeMatchPipeline).toHaveBeenCalled();
        expect(scenarioDistribution.unattributableBogusNameSkippedCount).toBe(0);
      });
    });

    describe('fingerprint hit/miss counters', () => {
      test('counts a TRUSTEE_VARIATION bucket hit as fingerprintHitCount', async () => {
        const event = makeEvent('case-001', 'John Doe');
        const variant = buildVariant(event.sourceTrustee);
        const fingerprint = computeFingerprint(variant);
        (mockVariationRepo.findByFingerprint as ReturnType<typeof vi.fn>).mockResolvedValue([
          { documentType: 'TRUSTEE_VARIATION', fingerprint, variant, trusteeId: 'trustee-123' },
        ]);

        const { scenarioDistribution } = await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          [event],
        );

        expect(scenarioDistribution.fingerprintHitCount).toBe(1);
        expect(scenarioDistribution.fingerprintMissCount).toBe(0);
        expect(pipelineOrchestrator.runTrusteeMatchPipeline).not.toHaveBeenCalled();
        expect(mockTrusteeCaseAppointmentsRepo.upsert).toHaveBeenCalledWith(
          expect.objectContaining({ caseId: 'case-001', trusteeId: 'trustee-123' }),
        );
      });

      test("a TRUSTEE_VARIATION bucket hit writes checks.matchedBy: 'variation' with matchedTrusteeAppointment from isAppointmentMatch", async () => {
        const event = makeEvent('case-001', 'John Doe');
        const variant = buildVariant(event.sourceTrustee);
        const fingerprint = computeFingerprint(variant);
        (mockVariationRepo.findByFingerprint as ReturnType<typeof vi.fn>).mockResolvedValue([
          { documentType: 'TRUSTEE_VARIATION', fingerprint, variant, trusteeId: 'trustee-123' },
        ]);
        (mockAppointmentsRepo.getTrusteeAppointments as ReturnType<typeof vi.fn>).mockResolvedValue(
          [],
        );

        await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          [event],
        );

        expect(mockTrusteeCaseAppointmentsRepo.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            caseId: 'case-001',
            trusteeId: 'trustee-123',
            checks: expect.objectContaining({
              matchedBy: 'variation',
              matchedTrusteeAppointment: false,
            }),
          }),
        );
      });

      test('counts a TRUSTEE_VARIATION bucket miss as fingerprintMissCount', async () => {
        const event = makeEvent('case-001', 'John Doe');

        const { scenarioDistribution } = await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          [event],
        );

        expect(scenarioDistribution.fingerprintHitCount).toBe(0);
        expect(scenarioDistribution.fingerprintMissCount).toBe(1);
      });

      test('tallies fingerprintHitCount/fingerprintMissCount correctly across a mixed batch', async () => {
        const hitEvent = makeEvent('case-001', 'Known Trustee');
        const missEvent = makeEvent('case-002', 'Unknown Trustee');
        const hitVariant = buildVariant(hitEvent.sourceTrustee);
        const hitFingerprint = computeFingerprint(hitVariant);
        (mockVariationRepo.findByFingerprint as ReturnType<typeof vi.fn>).mockImplementation(
          async (fingerprint: string) =>
            fingerprint === hitFingerprint
              ? [
                  {
                    documentType: 'TRUSTEE_VARIATION',
                    fingerprint: hitFingerprint,
                    variant: hitVariant,
                    trusteeId: 'trustee-123',
                  },
                ]
              : [],
        );

        const { scenarioDistribution } = await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          [hitEvent, missEvent],
        );

        expect(scenarioDistribution.fingerprintHitCount).toBe(1);
        expect(scenarioDistribution.fingerprintMissCount).toBe(1);
      });
    });

    describe('professional-id identification step', () => {
      test('resolves directly when exactly one CAMS trustee is linked, with matchedBy "professional-id"', async () => {
        const event = makeAcmsEvent('case-001', 'Jane Doe', 'NY-00063');
        mockProfessionalIdsRepo.findByAcmsProfessionalId = vi
          .fn()
          .mockResolvedValue([
            { camsTrusteeId: 'trustee-123', acmsProfessionalId: 'NY-00063', disposition: 'linked' },
          ]);

        await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          [event],
        );

        expect(pipelineOrchestrator.runTrusteeMatchPipeline).not.toHaveBeenCalled();
        expect(mockTrusteeCaseAppointmentsRepo.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            caseId: 'case-001',
            trusteeId: 'trustee-123',
            checks: expect.objectContaining({ matchedBy: 'professional-id' }),
          }),
        );
      });

      test('a professional-id-only match writes no TrusteeVariation and still creates the appointment for that trustee', async () => {
        const event = makeAcmsEvent('case-001', 'Jane Doe', 'NY-00063');
        mockProfessionalIdsRepo.findByAcmsProfessionalId = vi
          .fn()
          .mockResolvedValue([
            { camsTrusteeId: 'trustee-123', acmsProfessionalId: 'NY-00063', disposition: 'linked' },
          ]);

        await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          [event],
        );

        expect(pipelineOrchestrator.runTrusteeMatchPipeline).not.toHaveBeenCalled();
        expect(mockVariationRepo.createVariation).not.toHaveBeenCalled();
        expect(mockTrusteeCaseAppointmentsRepo.upsert).toHaveBeenCalledWith(
          expect.objectContaining({ caseId: 'case-001', trusteeId: 'trustee-123' }),
        );
      });

      test('falls through to variation/pipeline matching when there is no link', async () => {
        const event = makeAcmsEvent('case-001', 'Jane Doe', 'NY-00063');

        await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          [event],
        );

        expect(pipelineOrchestrator.runTrusteeMatchPipeline).toHaveBeenCalled();
      });

      test('falls through when the link is ambiguous (2+ distinct trustees)', async () => {
        const event = makeAcmsEvent('case-001', 'Jane Doe', 'NY-00064');
        mockProfessionalIdsRepo.findByAcmsProfessionalId = vi.fn().mockResolvedValue([
          { camsTrusteeId: 'trustee-a', acmsProfessionalId: 'NY-00064', disposition: 'linked' },
          { camsTrusteeId: 'trustee-b', acmsProfessionalId: 'NY-00064', disposition: 'linked' },
        ]);

        await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          [event],
        );

        expect(pipelineOrchestrator.runTrusteeMatchPipeline).toHaveBeenCalled();
      });

      test('treats repeated links to the same trustee as a single match, not ambiguous', async () => {
        const event = makeAcmsEvent('case-001', 'Jane Doe', 'NY-00063');
        mockProfessionalIdsRepo.findByAcmsProfessionalId = vi.fn().mockResolvedValue([
          { camsTrusteeId: 'trustee-123', acmsProfessionalId: 'NY-00063', disposition: 'linked' },
          { camsTrusteeId: 'trustee-123', acmsProfessionalId: 'NY-00063', disposition: 'linked' },
        ]);

        await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          [event],
        );

        expect(pipelineOrchestrator.runTrusteeMatchPipeline).not.toHaveBeenCalled();
        expect(mockTrusteeCaseAppointmentsRepo.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            checks: expect.objectContaining({ matchedBy: 'professional-id' }),
          }),
        );
      });

      test('is not consulted for a DXTR event (no acmsProfessionalId)', async () => {
        const event = makeEvent('case-001', 'Jane Doe');

        await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          [event],
        );

        expect(mockProfessionalIdsRepo.findByAcmsProfessionalId).not.toHaveBeenCalled();
      });

      test('a resolved professional-id link short-circuits the verification-bucket-hit check', async () => {
        const event = makeAcmsEvent('case-001', 'Jane Doe', 'NY-00063');
        mockProfessionalIdsRepo.findByAcmsProfessionalId = vi
          .fn()
          .mockResolvedValue([
            { camsTrusteeId: 'trustee-123', acmsProfessionalId: 'NY-00063', disposition: 'linked' },
          ]);
        const variant = buildVariant(event.sourceTrustee);
        const fingerprint = computeFingerprint(variant);
        (mockVerificationRepo.findByFingerprint as ReturnType<typeof vi.fn>).mockResolvedValue([
          { documentType: 'TRUSTEE_MATCH_VERIFICATION', fingerprint, variant, status: 'pending' },
        ]);

        await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          [event],
        );

        expect(mockTrusteeCaseAppointmentsRepo.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            checks: expect.objectContaining({ matchedBy: 'professional-id' }),
          }),
        );
      });
    });

    test('should soft-close old and create new when trustee changes, aligning unassignedOn to one day before the new assignedOn', async () => {
      const existingAppointment: CaseAppointment = {
        id: 'ca-old',
        caseId: 'case-001',
        trusteeId: 'old-trustee',
        assignedOn: '2024-01-01T00:00:00Z',
        createdOn: '2024-01-01T00:00:00Z',
        createdBy: { id: 'system', name: 'System' },
        updatedOn: '2024-01-01T00:00:00Z',
        updatedBy: { id: 'system', name: 'System' },
      };
      (
        mockTrusteeCaseAppointmentsRepo.getActiveByCaseId as ReturnType<typeof vi.fn>
      ).mockResolvedValue(existingAppointment);

      // makeEvent's appointedDate is '2024-01-15' — well after existingAppointment's assignedOn,
      // simulating sync lag: the job runs long after the DXTR-reported appointment date, but
      // unassignedOn must be derived from that date, not wall-clock time.
      const events = [makeEvent('case-001', 'John Doe')];

      await SyncTrusteeCaseAppointments.processAppointments(
        SyncTrusteeCaseAppointments.createDeps(context),
        events,
      );

      // Should soft-close old appointment with unassignedOn one day before the new assignedOn —
      // never wall-clock time — so the "Past Trustees" history reads as continuous, non-overlapping.
      expect(mockTrusteeCaseAppointmentsRepo.updateCaseAppointment).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'ca-old',
          trusteeId: 'old-trustee',
          unassignedOn: '2024-01-14',
        }),
      );

      // Should create new appointment
      expect(mockTrusteeCaseAppointmentsRepo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          caseId: 'case-001',
          trusteeId: 'trustee-123',
          assignedOn: '2024-01-15',
        }),
      );
    });

    test('should push SoftCloseWriteFailed to dlqMessages but still create the new appointment on a single non-transient soft-close failure', async () => {
      const existingAppointment: CaseAppointment = {
        id: 'ca-old',
        caseId: 'case-001',
        trusteeId: 'old-trustee',
        assignedOn: '2024-01-01T00:00:00Z',
        createdOn: '2024-01-01T00:00:00Z',
        createdBy: { id: 'system', name: 'System' },
        updatedOn: '2024-01-01T00:00:00Z',
        updatedBy: { id: 'system', name: 'System' },
      };
      (
        mockTrusteeCaseAppointmentsRepo.getActiveByCaseId as ReturnType<typeof vi.fn>
      ).mockResolvedValue(existingAppointment);
      (
        mockTrusteeCaseAppointmentsRepo.updateCaseAppointment as ReturnType<typeof vi.fn>
      ).mockRejectedValue(new Error('Cosmos write failed'));

      const events = [makeEvent('case-001', 'John Doe')];

      const { successCount, dlqMessages, retryableEvents, scenarioDistribution } =
        await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          events,
        );

      // Non-transient failure: single attempt only, no retry loop.
      expect(mockTrusteeCaseAppointmentsRepo.updateCaseAppointment).toHaveBeenCalledTimes(1);
      expect(retryableEvents).toHaveLength(0);
      expect(dlqMessages).toHaveLength(1);
      expect(dlqMessages[0]).toEqual(
        expect.objectContaining({
          caseId: 'case-001',
          mismatchReason: 'SOFT_CLOSE_WRITE_FAILED',
        }),
      );
      // The new appointment is still created despite the soft-close failure — unchanged
      // behavior for non-transient errors.
      expect(mockTrusteeCaseAppointmentsRepo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          caseId: 'case-001',
          trusteeId: 'trustee-123',
        }),
      );
      // This event is BOTH counted toward successCount (the match itself succeeded, and the new
      // appointment really was created) AND has an entry in dlqMessages (the old appointment's
      // soft-close needs manual replay) — processAppointments' aggregation loop must handle both
      // simultaneously via EventOutcome's dlqFailure field, not silently drop one.
      expect(successCount).toBe(1);
      expect(scenarioDistribution.autoMatchCount).toBe(1);
    });

    describe('DISP_DATE and out-of-order appointments', () => {
      test('closes the active appointment using event.unassignedOn directly when the same trustee is disposed, with no replacement', async () => {
        const existingAppointment: CaseAppointment = {
          id: 'ca-1',
          caseId: 'case-001',
          trusteeId: 'trustee-123',
          assignedOn: '2024-01-15',
          createdOn: '2024-01-01T00:00:00Z',
          createdBy: { id: 'system', name: 'System' },
          updatedOn: '2024-01-01T00:00:00Z',
          updatedBy: { id: 'system', name: 'System' },
        };
        (
          mockTrusteeCaseAppointmentsRepo.getActiveByCaseId as ReturnType<typeof vi.fn>
        ).mockResolvedValue(existingAppointment);

        const event = { ...makeEvent('case-001', 'John Doe'), unassignedOn: '2024-03-01' };

        await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          [event],
        );

        expect(mockTrusteeCaseAppointmentsRepo.updateCaseAppointment).toHaveBeenCalledWith(
          expect.objectContaining({
            id: 'ca-1',
            trusteeId: 'trustee-123',
            unassignedOn: '2024-03-01',
          }),
        );
        expect(mockTrusteeCaseAppointmentsRepo.upsert).not.toHaveBeenCalled();
      });

      test("records a DISP_DATE that predates the appointment's own assignedOn as given, and warns", async () => {
        const existingAppointment: CaseAppointment = {
          id: 'ca-1',
          caseId: 'case-001',
          trusteeId: 'trustee-123',
          assignedOn: '2024-01-15',
          createdOn: '2024-01-01T00:00:00Z',
          createdBy: { id: 'system', name: 'System' },
          updatedOn: '2024-01-01T00:00:00Z',
          updatedBy: { id: 'system', name: 'System' },
        };
        (
          mockTrusteeCaseAppointmentsRepo.getActiveByCaseId as ReturnType<typeof vi.fn>
        ).mockResolvedValue(existingAppointment);

        // An out-of-order DISP_DATE older than the appointment's own assignedOn.
        const warnSpy = vi.spyOn(context.logger, 'warn');
        const event = { ...makeEvent('case-001', 'John Doe'), unassignedOn: '2024-01-01' };

        await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          [event],
        );

        expect(mockTrusteeCaseAppointmentsRepo.updateCaseAppointment).toHaveBeenCalledWith(
          expect.objectContaining({ unassignedOn: '2024-01-01' }),
        );
        expect(warnSpy).toHaveBeenCalledWith(
          expect.any(String),
          expect.stringContaining('precedes'),
        );
      });

      test.each([
        {
          disposition: '2024-03-01',
          expectedUnassignedOn: '2024-03-01',
          description: 'writes DISP_DATE as the new appointment close',
        },
        {
          disposition: '2024-01-10',
          expectedUnassignedOn: '2024-01-10',
          description: 'records a DISP_DATE older than APPT_DATE as given',
        },
      ])(
        'when an ACMS row carries DISP_DATE and no appointment exists, $description',
        async ({ disposition, expectedUnassignedOn }) => {
          const event = {
            ...makeAcmsEvent('case-001', 'John Doe', 'NY-00063'),
            unassignedOn: disposition,
          };

          await SyncTrusteeCaseAppointments.processAppointments(
            SyncTrusteeCaseAppointments.createDeps(context),
            [event],
          );

          expect(mockTrusteeCaseAppointmentsRepo.updateCaseAppointment).not.toHaveBeenCalled();
          expect(mockTrusteeCaseAppointmentsRepo.upsert).toHaveBeenCalledTimes(1);
          expect(mockTrusteeCaseAppointmentsRepo.upsert).toHaveBeenCalledWith(
            expect.objectContaining({
              caseId: 'case-001',
              trusteeId: 'trustee-123',
              assignedOn: '2024-01-15',
              unassignedOn: expectedUnassignedOn,
            }),
          );
        },
      );

      test('writes the new appointment already closed when a normal-order reassignment carries DISP_DATE', async () => {
        const existingAppointment: CaseAppointment = {
          id: 'ca-old',
          caseId: 'case-001',
          trusteeId: 'old-trustee',
          assignedOn: '2024-01-01T00:00:00Z',
          createdOn: '2024-01-01T00:00:00Z',
          createdBy: { id: 'system', name: 'System' },
          updatedOn: '2024-01-01T00:00:00Z',
          updatedBy: { id: 'system', name: 'System' },
        };
        (
          mockTrusteeCaseAppointmentsRepo.getActiveByCaseId as ReturnType<typeof vi.fn>
        ).mockResolvedValue(existingAppointment);

        const event = { ...makeEvent('case-001', 'John Doe'), unassignedOn: '2024-03-01' };

        await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          [event],
        );

        expect(mockTrusteeCaseAppointmentsRepo.updateCaseAppointment).toHaveBeenCalledWith(
          expect.objectContaining({ id: 'ca-old', unassignedOn: '2024-01-14' }),
        );
        expect(mockTrusteeCaseAppointmentsRepo.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            trusteeId: 'trustee-123',
            assignedOn: '2024-01-15',
            unassignedOn: '2024-03-01',
          }),
        );
      });

      test('an older record for the same trustee is written closed and leaves the newer appointment untouched', async () => {
        const newer: CaseAppointment = {
          id: 'ca-newer',
          caseId: 'case-001',
          trusteeId: 'trustee-123',
          assignedOn: '2024-02-01',
          createdOn: '2024-01-01T00:00:00Z',
          createdBy: { id: 'system', name: 'System' },
          updatedOn: '2024-01-01T00:00:00Z',
          updatedBy: { id: 'system', name: 'System' },
        };
        (
          mockTrusteeCaseAppointmentsRepo.getActiveByCaseId as ReturnType<typeof vi.fn>
        ).mockResolvedValue(newer);

        // makeEvent's appointedDate (2024-01-15) predates the newer appointment's 2024-02-01.
        await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          [makeEvent('case-001', 'John Doe')],
        );

        expect(mockTrusteeCaseAppointmentsRepo.updateCaseAppointment).not.toHaveBeenCalled();
        // The derived close is only a fallback, so a court disposition already stored for this
        // row is never replaced by it (PR #3283 review).
        expect(mockTrusteeCaseAppointmentsRepo.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            caseId: 'case-001',
            trusteeId: 'trustee-123',
            assignedOn: '2024-01-15',
          }),
          'CASE_APPOINTMENT',
          { fallbackUnassignedOn: '2024-01-31' },
        );
        expect(
          (mockTrusteeCaseAppointmentsRepo.upsert as ReturnType<typeof vi.fn>).mock.calls[0][0],
        ).not.toHaveProperty('unassignedOn');
      });

      test('a newer record for the same trustee closes the existing appointment and opens the new one (latest wins)', async () => {
        const existing: CaseAppointment = {
          id: 'ca-older',
          caseId: 'case-001',
          trusteeId: 'trustee-123',
          assignedOn: '2024-01-01',
          createdOn: '2024-01-01T00:00:00Z',
          createdBy: { id: 'system', name: 'System' },
          updatedOn: '2024-01-01T00:00:00Z',
          updatedBy: { id: 'system', name: 'System' },
        };
        (
          mockTrusteeCaseAppointmentsRepo.getActiveByCaseId as ReturnType<typeof vi.fn>
        ).mockResolvedValue(existing);

        // makeEvent's appointedDate (2024-01-15) is later than the existing 2024-01-01 appointment.
        await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          [makeEvent('case-001', 'John Doe')],
        );

        expect(mockTrusteeCaseAppointmentsRepo.updateCaseAppointment).toHaveBeenCalledWith(
          expect.objectContaining({ id: 'ca-older', unassignedOn: '2024-01-14' }),
        );
        expect(mockTrusteeCaseAppointmentsRepo.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            caseId: 'case-001',
            trusteeId: 'trustee-123',
            assignedOn: '2024-01-15',
          }),
        );
        expect(mockTrusteeCaseAppointmentsRepo.upsert).toHaveBeenCalledTimes(1);
      });

      test('writes an older out-of-order appointment already closed instead of displacing the active one', async () => {
        const existingAppointment: CaseAppointment = {
          id: 'ca-active',
          caseId: 'case-001',
          trusteeId: 'old-trustee',
          assignedOn: '2024-02-01',
          createdOn: '2024-01-01T00:00:00Z',
          createdBy: { id: 'system', name: 'System' },
          updatedOn: '2024-01-01T00:00:00Z',
          updatedBy: { id: 'system', name: 'System' },
        };
        (
          mockTrusteeCaseAppointmentsRepo.getActiveByCaseId as ReturnType<typeof vi.fn>
        ).mockResolvedValue(existingAppointment);

        // makeEvent's appointedDate ('2024-01-15') is older than existingAppointment.assignedOn.
        const events = [makeEvent('case-001', 'John Doe')];

        await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          events,
        );

        // The currently-active appointment is left untouched — it is not displaced.
        expect(mockTrusteeCaseAppointmentsRepo.updateCaseAppointment).not.toHaveBeenCalled();
        // The older row is written already closed, one day before the active appointment starts.
        // The derived close is only a fallback, so a court disposition already stored for this
        // row is never replaced by it (PR #3283 review).
        expect(mockTrusteeCaseAppointmentsRepo.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            caseId: 'case-001',
            trusteeId: 'trustee-123',
            assignedOn: '2024-01-15',
          }),
          'CASE_APPOINTMENT',
          { fallbackUnassignedOn: '2024-01-31' },
        );
        expect(
          (mockTrusteeCaseAppointmentsRepo.upsert as ReturnType<typeof vi.fn>).mock.calls[0][0],
        ).not.toHaveProperty('unassignedOn');
      });

      test('records an older out-of-order row with its own DISP_DATE as given, instead of the derived close', async () => {
        const existingAppointment: CaseAppointment = {
          id: 'ca-active',
          caseId: 'case-001',
          trusteeId: 'old-trustee',
          assignedOn: '2024-02-01',
          createdOn: '2024-01-01T00:00:00Z',
          createdBy: { id: 'system', name: 'System' },
          updatedOn: '2024-01-01T00:00:00Z',
          updatedBy: { id: 'system', name: 'System' },
        };
        (
          mockTrusteeCaseAppointmentsRepo.getActiveByCaseId as ReturnType<typeof vi.fn>
        ).mockResolvedValue(existingAppointment);

        const event = { ...makeEvent('case-001', 'John Doe'), unassignedOn: '2024-01-20' };

        await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          [event],
        );

        expect(mockTrusteeCaseAppointmentsRepo.updateCaseAppointment).not.toHaveBeenCalled();
        expect(mockTrusteeCaseAppointmentsRepo.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            caseId: 'case-001',
            trusteeId: 'trustee-123',
            assignedOn: '2024-01-15',
            unassignedOn: '2024-01-20',
          }),
        );
      });
    });

    test.each([
      ['TooManyRequestsError', new TooManyRequestsError('TEST', { message: 'Throttled.' })],
      ['GatewayTimeoutError', new GatewayTimeoutError('TEST', { message: 'Timed out.' })],
    ])(
      'should abort before creating a new appointment and route to retryableEvents on a transient soft-close failure (%s)',
      async (_label, transientError) => {
        const existingAppointment: CaseAppointment = {
          id: 'ca-old',
          caseId: 'case-001',
          trusteeId: 'old-trustee',
          assignedOn: '2024-01-01T00:00:00Z',
          createdOn: '2024-01-01T00:00:00Z',
          createdBy: { id: 'system', name: 'System' },
          updatedOn: '2024-01-01T00:00:00Z',
          updatedBy: { id: 'system', name: 'System' },
        };
        (
          mockTrusteeCaseAppointmentsRepo.getActiveByCaseId as ReturnType<typeof vi.fn>
        ).mockResolvedValue(existingAppointment);
        (
          mockTrusteeCaseAppointmentsRepo.updateCaseAppointment as ReturnType<typeof vi.fn>
        ).mockRejectedValue(transientError);

        const events = [makeEvent('case-001', 'John Doe')];

        const { dlqMessages, retryableEvents, scenarioDistribution } =
          await SyncTrusteeCaseAppointments.processAppointments(
            SyncTrusteeCaseAppointments.createDeps(context),
            events,
          );

        expect(mockTrusteeCaseAppointmentsRepo.updateCaseAppointment).toHaveBeenCalledTimes(1);
        expect(dlqMessages).toHaveLength(0);
        expect(retryableEvents).toHaveLength(1);
        expect(retryableEvents[0]).toEqual(expect.objectContaining({ caseId: 'case-001' }));
        expect(scenarioDistribution.retryableCount).toBe(1);
        // The core correctness property: never create the new appointment when the old
        // one's soft-close failed transiently — that is what avoids two active appointments.
        expect(mockTrusteeCaseAppointmentsRepo.upsert).not.toHaveBeenCalled();
      },
    );

    test('should route a TooManyRequestsError to retryableEvents instead of dlqMessages', async () => {
      (mockTrusteeCaseAppointmentsRepo.upsert as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new TooManyRequestsError('TEST', { message: 'Service is temporarily unavailable.' }),
      );

      const events = [makeEvent('case-001', 'John Doe')];

      const { dlqMessages, retryableEvents, successCount, scenarioDistribution } =
        await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          events,
        );

      expect(dlqMessages).toHaveLength(0);
      expect(retryableEvents).toHaveLength(1);
      expect(retryableEvents[0]).toEqual(expect.objectContaining({ caseId: 'case-001' }));
      expect(successCount).toBe(0);
      expect(scenarioDistribution.retryableCount).toBe(1);
    });

    test('should route a GatewayTimeoutError to retryableEvents instead of dlqMessages', async () => {
      (mockTrusteeCaseAppointmentsRepo.upsert as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new GatewayTimeoutError('TEST', { message: 'Query failed. Search request timed out.' }),
      );

      const events = [makeEvent('case-001', 'John Doe')];

      const { dlqMessages, retryableEvents, successCount, scenarioDistribution } =
        await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          events,
        );

      expect(dlqMessages).toHaveLength(0);
      expect(retryableEvents).toHaveLength(1);
      expect(retryableEvents[0]).toEqual(expect.objectContaining({ caseId: 'case-001' }));
      expect(successCount).toBe(0);
      expect(scenarioDistribution.retryableCount).toBe(1);
    });

    test('should route a transient error from the fingerprint lookup to retryableEvents instead of propagating unhandled', async () => {
      (mockVariationRepo.findByFingerprint as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new TooManyRequestsError('TEST', { message: 'Service is temporarily unavailable.' }),
      );

      const events = [makeEvent('case-001', 'John Doe')];

      const { dlqMessages, retryableEvents, successCount, scenarioDistribution } =
        await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          events,
        );

      expect(dlqMessages).toHaveLength(0);
      expect(retryableEvents).toHaveLength(1);
      expect(retryableEvents[0]).toEqual(expect.objectContaining({ caseId: 'case-001' }));
      expect(successCount).toBe(0);
      expect(scenarioDistribution.retryableCount).toBe(1);
    });

    test('should continue processing subsequent events after a transient error on an earlier one', async () => {
      (mockTrusteeCaseAppointmentsRepo.upsert as ReturnType<typeof vi.fn>)
        .mockRejectedValueOnce(new TooManyRequestsError('TEST', { message: 'Throttled.' }))
        .mockResolvedValue({} as CaseAppointment);

      const events = [makeEvent('case-001', 'John Doe'), makeEvent('case-002', 'Jane Roe')];

      const { retryableEvents, successCount } =
        await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          events,
        );

      expect(retryableEvents).toHaveLength(1);
      expect(retryableEvents[0]).toEqual(expect.objectContaining({ caseId: 'case-001' }));
      expect(successCount).toBe(1);
    });

    test('should add unclassified error to dlqMessages and continue processing', async () => {
      (pipelineOrchestrator.runTrusteeMatchPipeline as ReturnType<typeof vi.fn>)
        .mockRejectedValueOnce(new Error('Match failed'))
        .mockResolvedValueOnce(makeResolvedState('trustee-456'));

      (mockCasesRepo.getCaseOrMovedCase as ReturnType<typeof vi.fn>).mockResolvedValue({
        caseId: 'case-002',
        trusteeId: undefined,
        courtId: '081',
        courtDivisionCode: '081',
        chapter: '7',
      });

      const events = [makeEvent('case-001', 'Bad Name'), makeEvent('case-002', 'Jane Smith')];

      const { successCount, dlqMessages, scenarioDistribution } =
        await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          events,
        );

      // First event — unclassified error goes to DLQ with raw error shape
      expect(dlqMessages).toHaveLength(1);
      expect((dlqMessages[0] as TrusteeAppointmentSyncEvent).error).toBeDefined();

      // Second event should succeed
      expect(successCount).toBe(1);
      expect(mockTrusteeCaseAppointmentsRepo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          caseId: 'case-002',
          trusteeId: 'trustee-456',
        }),
      );
      // Unclassified error doesn't increment any named distribution counter
      expect(scenarioDistribution.autoMatchCount).toBe(1);
    });

    test('should no-op (not an identity task, not DLQ) when the pipeline itself skips as an administrative placeholder', async () => {
      // A new edge case that didn't exist under the old numeric-scoring resolver: this file's own
      // DXTR-specific skip checks (resolvePreMatchShortCircuit/handleBogusTrusteeCloseOnly) have
      // already passed by the time the pipeline runs, but the pipeline's own
      // skipAdministrativePlaceholder stage can still fire (e.g. "U.S. Trustee").
      (
        pipelineOrchestrator.runTrusteeMatchPipeline as ReturnType<typeof vi.fn>
      ).mockResolvedValueOnce(makeSkippedState());

      const { successCount, dlqMessages, scenarioDistribution } =
        await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          [makeEvent('case-001', 'U.S. Trustee')],
        );

      expect(dlqMessages).toHaveLength(0);
      expect(successCount).toBe(0);
      expect(mockVerificationRepo.upsertVerification).not.toHaveBeenCalled();
      expect(mockTrusteeCaseAppointmentsRepo.upsert).not.toHaveBeenCalled();
      expect(scenarioDistribution.pipelineSkippedCount).toBe(1);
    });

    test('should route to retryableEvents/dlqMessages (not an identity task) when the pipeline resolves with a non-null error', async () => {
      // Distinct from the rejected-promise case above: here runTrusteeMatchPipeline resolves
      // successfully but the returned state itself carries a processing failure on state.error —
      // resolveTrusteeViaPipeline rethrows it unconditionally so it reaches the same one catch.
      (
        pipelineOrchestrator.runTrusteeMatchPipeline as ReturnType<typeof vi.fn>
      ).mockResolvedValueOnce(
        makeErrorState(new CamsError('TEST-MODULE', { message: 'Recall failed.' })),
      );

      const { dlqMessages, retryableEvents, successCount } =
        await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          [makeEvent('case-001', 'Jane Doe')],
        );

      expect(retryableEvents).toHaveLength(0);
      expect(dlqMessages).toHaveLength(1);
      expect(successCount).toBe(0);
      expect(mockVerificationRepo.upsertVerification).not.toHaveBeenCalled();
    });

    test('should persist NO_TRUSTEE_MATCH to verification collection, not DLQ', async () => {
      (
        pipelineOrchestrator.runTrusteeMatchPipeline as ReturnType<typeof vi.fn>
      ).mockResolvedValueOnce(makeUnresolvedState(0));

      const { dlqMessages, successCount, scenarioDistribution } =
        await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          [makeEvent('case-001', 'Ghost Trustee')],
        );

      expect(dlqMessages).toHaveLength(0);
      expect(mockVerificationRepo.upsertVerification).toHaveBeenCalled();
      expect(mockTrusteeCaseAppointmentsRepo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          caseId: 'case-001',
          isSurrogate: true,
        }),
      );
      expect(successCount).toBe(0);
      expect(scenarioDistribution.noMatchCount).toBe(1);
    });

    test('routes to dlqMessages and writes no surrogate when appointedDate is missing on an unresolved match', async () => {
      // writeSurrogateAppointment's own assertAppointedDate guard -- the third of three call
      // sites sharing this check (see its docblock), reached only on the no-match/ambiguous
      // path after the verification doc is already written.
      (
        pipelineOrchestrator.runTrusteeMatchPipeline as ReturnType<typeof vi.fn>
      ).mockResolvedValueOnce(makeUnresolvedState(0));
      const errorSpy = vi.spyOn(context.logger, 'error');
      const event: TrusteeAppointmentSyncEvent = {
        ...makeEvent('case-001', 'Ghost Trustee'),
        appointedDate: undefined,
      };

      const { dlqMessages, successCount } = await SyncTrusteeCaseAppointments.processAppointments(
        SyncTrusteeCaseAppointments.createDeps(context),
        [event],
      );

      expect(dlqMessages).toHaveLength(1);
      expect(mockTrusteeCaseAppointmentsRepo.upsert).not.toHaveBeenCalled();
      expect(successCount).toBe(0);
      expect(errorSpy).toHaveBeenCalledWith(
        'SYNC-TRUSTEE-CASE-APPOINTMENTS-USE-CASE',
        expect.stringContaining('TRUSTEE APPOINTMENT DATA INTEGRITY ERROR'),
      );
    });

    test('should construct acmsProfessionalId from groupDesignator + profCode on the persisted verification doc', async () => {
      // acmsProfessionalId is a CAMS construct, not a native DXTR/ACMS field - the gateway only
      // crosses raw groupDesignator + profCode facts; this format ("{group}-{profCode}") is built
      // here in the use-case layer. It's never used to pick or auto-link a trustee (see
      // isSentinelWithNoIdentity's doc comment, which keys off the underlying raw profCode) -
      // it's persisted purely so a reviewer can distinguish a genuine unmatched trustee from a
      // sentinel-coded ("00000"/"99999") placeholder without cross-referencing DXTR directly.
      (
        pipelineOrchestrator.runTrusteeMatchPipeline as ReturnType<typeof vi.fn>
      ).mockResolvedValueOnce(makeUnresolvedState(0));

      await SyncTrusteeCaseAppointments.processAppointments(
        SyncTrusteeCaseAppointments.createDeps(context),
        [
          {
            ...makeEvent('case-001', 'Nobody Real'),
            profCode: '12345',
            groupDesignator: 'NY',
            sourceTrustee: {
              fullName: 'Nobody Real',
              firstName: 'Nobody',
              lastName: 'Real',
              legacy: { address1: '1 Real St', cityStateZipCountry: 'Realtown ZZ 00000' },
            },
          },
        ],
      );

      expect(mockVerificationRepo.upsertVerification).toHaveBeenCalledWith(
        expect.objectContaining({ acmsProfessionalId: 'NY-12345' }),
      );
    });

    test('should omit acmsProfessionalId from the persisted verification doc when profCode is a sentinel value', async () => {
      // A formatted sentinel ID (e.g. "NY-99999") would read to a reviewer as a real professional
      // ID rather than the "ID unavailable" placeholder it actually is - suppress it entirely
      // rather than persist misleading diagnostic data.
      (
        pipelineOrchestrator.runTrusteeMatchPipeline as ReturnType<typeof vi.fn>
      ).mockResolvedValueOnce(makeUnresolvedState(0));

      await SyncTrusteeCaseAppointments.processAppointments(
        SyncTrusteeCaseAppointments.createDeps(context),
        [
          {
            ...makeEvent('case-001', 'Nobody Real'),
            profCode: '99999',
            groupDesignator: 'NY',
            sourceTrustee: {
              fullName: 'Nobody Real',
              firstName: 'Nobody',
              lastName: 'Real',
              legacy: { address1: '1 Real St', cityStateZipCountry: 'Realtown ZZ 00000' },
            },
          },
        ],
      );

      expect(mockVerificationRepo.upsertVerification).toHaveBeenCalledWith(
        expect.objectContaining({ acmsProfessionalId: undefined }),
      );
    });

    test('should omit acmsProfessionalId from the persisted verification doc when groupDesignator is missing', async () => {
      (
        pipelineOrchestrator.runTrusteeMatchPipeline as ReturnType<typeof vi.fn>
      ).mockResolvedValueOnce(makeUnresolvedState(0));

      await SyncTrusteeCaseAppointments.processAppointments(
        SyncTrusteeCaseAppointments.createDeps(context),
        [
          {
            ...makeEvent('case-001', 'Nobody Real'),
            profCode: '12345',
            sourceTrustee: {
              fullName: 'Nobody Real',
              firstName: 'Nobody',
              lastName: 'Real',
              legacy: { address1: '1 Real St', cityStateZipCountry: 'Realtown ZZ 00000' },
            },
          },
        ],
      );

      expect(mockVerificationRepo.upsertVerification).toHaveBeenCalledWith(
        expect.objectContaining({ acmsProfessionalId: undefined }),
      );
    });

    test('should auto-link a pipeline-resolved trustee whose appointment matches court/division/chapter', async () => {
      (
        pipelineOrchestrator.runTrusteeMatchPipeline as ReturnType<typeof vi.fn>
      ).mockResolvedValueOnce(makeResolvedState('t-1', 'resolveByAddress'));

      const { successCount, dlqMessages, scenarioDistribution } =
        await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          [makeEvent('case-001', 'Common Name')],
        );

      expect(mockTrusteeCaseAppointmentsRepo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          caseId: 'case-001',
          trusteeId: 't-1',
          checks: expect.objectContaining({
            matchedTrusteeAppointment: true,
            matchedBy: 'resolveByAddress',
          }),
        }),
      );
      expect(mockVerificationRepo.upsertVerification).not.toHaveBeenCalled();
      expect(successCount).toBe(1);
      expect(dlqMessages).toHaveLength(0);
      expect(scenarioDistribution.autoMatchCount).toBe(1);
      expect(scenarioDistribution.autoMatchUncoveredCount).toBe(0);
    });

    test('should still auto-link a pipeline-resolved trustee whose appointment does not cover court/division/chapter (decision 1a: no coverage gate)', async () => {
      (
        pipelineOrchestrator.runTrusteeMatchPipeline as ReturnType<typeof vi.fn>
      ).mockResolvedValueOnce(makeResolvedState('t-1', 'resolveByAddress'));
      // The winner only has an active appointment in the same court on a DIFFERENT division
      // ('082', not the event's '081') — decision 1a (2026-10-27) removed the old coverage gate
      // that used to route this to a human-review IMPERFECT_MATCH task; the appointment is still
      // written, with checks.matchedTrusteeAppointment recording the miss for #3190.
      (mockAppointmentsRepo.getTrusteeAppointments as ReturnType<typeof vi.fn>).mockResolvedValue([
        { ...coveringAppointment(), trusteeId: 't-1', divisionCodes: ['082'] },
      ]);
      const infoSpy = vi.spyOn(context.logger, 'info');

      const { successCount, dlqMessages, scenarioDistribution } =
        await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          [makeEvent('case-001', 'Common Name')],
        );

      expect(mockTrusteeCaseAppointmentsRepo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          caseId: 'case-001',
          trusteeId: 't-1',
          checks: expect.objectContaining({
            matchedTrusteeAppointment: false,
            matchedBy: 'resolveByAddress',
          }),
        }),
      );
      expect(mockVerificationRepo.upsertVerification).not.toHaveBeenCalled();
      expect(successCount).toBe(1);
      expect(dlqMessages).toHaveLength(0);
      expect(scenarioDistribution.autoMatchCount).toBe(1);
      expect(scenarioDistribution.autoMatchUncoveredCount).toBe(1);

      const auditCall = infoSpy.mock.calls.find((call) => call[1] === 'TRUSTEE_MATCH_AUDIT');
      expect(auditCall?.[2]).toMatchObject({ appointmentStatus: 'uncovered' });
    });

    test('should persist an ambiguous identity task when the pipeline finds 2+ unresolved candidates, not DLQ', async () => {
      (
        pipelineOrchestrator.runTrusteeMatchPipeline as ReturnType<typeof vi.fn>
      ).mockResolvedValueOnce(makeUnresolvedState(2));

      const { dlqMessages, successCount, scenarioDistribution } =
        await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          [makeEvent('case-001', 'Common Name')],
        );

      expect(dlqMessages).toHaveLength(0);
      expect(mockVerificationRepo.upsertVerification).toHaveBeenCalledWith(
        expect.objectContaining({
          mismatchReason: 'ambiguous',
          source: 'DXTR',
        }),
      );
      expect(mockTrusteeCaseAppointmentsRepo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          caseId: 'case-001',
          isSurrogate: true,
        }),
      );
      expect(successCount).toBe(0);
      expect(scenarioDistribution.multipleMatchCount).toBe(1);
    });

    test.each([
      ['TooManyRequestsError', new TooManyRequestsError('TEST', { message: 'Throttled.' })],
      ['GatewayTimeoutError', new GatewayTimeoutError('TEST', { message: 'Timed out.' })],
    ])(
      'should route to retryableEvents (not an identity task) when the pipeline fails transiently (%s)',
      async (_label, transientError) => {
        // Drives execution through processAppointments' single outer catch (originalError) block
        // in sync-trustee-case-appointments.ts — resolveTrusteeViaPipeline never catches
        // runTrusteeMatchPipeline's own rejection itself, so this is the only way to exercise the
        // control-flow this file relies on (see isTransientInfraError's doc comment / cams-o5gh):
        // a rethrow from the pipeline call alone would not prove the outer file routes it
        // correctly.
        (
          pipelineOrchestrator.runTrusteeMatchPipeline as ReturnType<typeof vi.fn>
        ).mockRejectedValueOnce(transientError);

        const { dlqMessages, retryableEvents, successCount, scenarioDistribution } =
          await SyncTrusteeCaseAppointments.processAppointments(
            SyncTrusteeCaseAppointments.createDeps(context),
            [makeEvent('case-001', 'Common Name')],
          );

        expect(retryableEvents).toHaveLength(1);
        expect(retryableEvents[0]).toEqual(expect.objectContaining({ caseId: 'case-001' }));
        expect(dlqMessages).toHaveLength(0);
        expect(successCount).toBe(0);
        expect(scenarioDistribution.multipleMatchCount).toBe(0);
        expect(scenarioDistribution.noMatchCount).toBe(0);
        expect(scenarioDistribution.retryableCount).toBe(1);
        expect(mockVerificationRepo.upsertVerification).not.toHaveBeenCalled();
        expect(mockTrusteeCaseAppointmentsRepo.upsert).not.toHaveBeenCalled();
      },
    );

    test('should fall back to raw error shape when error has data but unknown mismatchReason', async () => {
      const unknownError = new CamsError('SOME-MODULE', {
        message: 'Unknown data error',
        data: { mismatchReason: 'SOME_UNKNOWN_CODE', extra: 'value' },
      });
      (
        pipelineOrchestrator.runTrusteeMatchPipeline as ReturnType<typeof vi.fn>
      ).mockRejectedValueOnce(unknownError);

      const { dlqMessages } = await SyncTrusteeCaseAppointments.processAppointments(
        SyncTrusteeCaseAppointments.createDeps(context),
        [makeEvent('case-001', 'John Doe')],
      );

      expect(dlqMessages).toHaveLength(1);
      expect((dlqMessages[0] as TrusteeAppointmentSyncEvent).error).toBeDefined();
      expect('mismatchReason' in dlqMessages[0]).toBe(false);
    });

    test('scenarioDistribution counts sum to total events processed for mixed batch', async () => {
      (pipelineOrchestrator.runTrusteeMatchPipeline as ReturnType<typeof vi.fn>)
        // Event 1: resolved and covered — auto-match
        .mockResolvedValueOnce(makeResolvedState('trustee-1'))
        // Event 2: no match
        .mockResolvedValueOnce(makeUnresolvedState(0))
        // Event 3: resolved but uncovered — still auto-links under decision 1a
        .mockResolvedValueOnce(makeResolvedState('trustee-3'));

      // trustee-3 has no appointments, so event 3 is uncovered
      (mockAppointmentsRepo.getTrusteeAppointments as ReturnType<typeof vi.fn>).mockImplementation(
        async (trusteeId: string) => (trusteeId === 'trustee-3' ? [] : [coveringAppointment()]),
      );

      const events = [
        makeEvent('case-001', 'Perfect'),
        makeEvent('case-002', 'NoMatch'),
        makeEvent('case-003', 'Uncovered'),
      ];

      const { scenarioDistribution } = await SyncTrusteeCaseAppointments.processAppointments(
        SyncTrusteeCaseAppointments.createDeps(context),
        events,
      );

      const sum =
        scenarioDistribution.autoMatchCount +
        scenarioDistribution.noMatchCount +
        scenarioDistribution.multipleMatchCount;

      expect(sum).toBe(events.length);
      expect(scenarioDistribution.autoMatchCount).toBe(2);
      expect(scenarioDistribution.noMatchCount).toBe(1);
    });

    test('should emit TRUSTEE_MATCH_AUDIT log for auto-matched event', async () => {
      const infoSpy = vi.spyOn(context.logger, 'info');
      const events = [makeEvent('case-001', 'John Doe')];

      await SyncTrusteeCaseAppointments.processAppointments(
        SyncTrusteeCaseAppointments.createDeps(context),
        events,
      );

      const auditCalls = infoSpy.mock.calls.filter((call) => call[1] === 'TRUSTEE_MATCH_AUDIT');
      expect(auditCalls).toHaveLength(1);
      expect(auditCalls[0][2]).toEqual(
        expect.objectContaining({
          caseId: 'case-001',
          sourceTrusteeName: 'John Doe',
          matchOutcome: 'auto-matched',
          matchedTrusteeId: 'trustee-123',
          appointmentStatus: 'active',
        }),
      );
    });

    test('should emit TRUSTEE_MATCH_AUDIT log for a pipeline-resolved auto-link', async () => {
      (
        pipelineOrchestrator.runTrusteeMatchPipeline as ReturnType<typeof vi.fn>
      ).mockResolvedValueOnce(makeResolvedState('t-1', 'resolveByAddress'));
      const infoSpy = vi.spyOn(context.logger, 'info');

      await SyncTrusteeCaseAppointments.processAppointments(
        SyncTrusteeCaseAppointments.createDeps(context),
        [makeEvent('case-001', 'Common Name')],
      );

      const auditCalls = infoSpy.mock.calls.filter((call) => call[1] === 'TRUSTEE_MATCH_AUDIT');
      expect(auditCalls).toHaveLength(1);
      expect(auditCalls[0][2]).toEqual(
        expect.objectContaining({
          matchOutcome: 'auto-matched',
          matchedTrusteeId: 't-1',
        }),
      );
    });

    test('should emit TRUSTEE_MATCH_AUDIT log for NO_TRUSTEE_MATCH event', async () => {
      (
        pipelineOrchestrator.runTrusteeMatchPipeline as ReturnType<typeof vi.fn>
      ).mockResolvedValueOnce(makeUnresolvedState(0));
      const infoSpy = vi.spyOn(context.logger, 'info');

      await SyncTrusteeCaseAppointments.processAppointments(
        SyncTrusteeCaseAppointments.createDeps(context),
        [makeEvent('case-001', 'Ghost')],
      );

      const auditCalls = infoSpy.mock.calls.filter((call) => call[1] === 'TRUSTEE_MATCH_AUDIT');
      expect(auditCalls).toHaveLength(1);
      expect(auditCalls[0][2]).toEqual(
        expect.objectContaining({
          matchOutcome: 'no-match',
          matchedTrusteeId: null,
        }),
      );
    });

    test('should emit exactly one TRUSTEE_MATCH_AUDIT per event in a batch', async () => {
      const infoSpy = vi.spyOn(context.logger, 'info');
      const events = [
        makeEvent('case-001', 'John Doe'),
        makeEvent('case-002', 'Jane Smith'),
        makeEvent('case-003', 'Bob Jones'),
      ];

      await SyncTrusteeCaseAppointments.processAppointments(
        SyncTrusteeCaseAppointments.createDeps(context),
        events,
      );

      const auditCalls = infoSpy.mock.calls.filter((call) => call[1] === 'TRUSTEE_MATCH_AUDIT');
      expect(auditCalls).toHaveLength(3);
    });

    describe("DISP_DATE closes an already-placeholder'd fingerprint (cams-fd8qd.1.9)", () => {
      test('closes the open surrogate with the disposition as given and writes no new task when the fingerprint is already unresolved', async () => {
        (
          pipelineOrchestrator.runTrusteeMatchPipeline as ReturnType<typeof vi.fn>
        ).mockResolvedValueOnce(makeUnresolvedState(0));

        const event = { ...makeEvent('case-001', 'Ghost Trustee'), unassignedOn: '2026-09-01' };
        const variant = buildVariant(event.sourceTrustee);
        const fingerprint = computeFingerprint(variant);
        const openSurrogate: CaseAppointment = {
          id: 'surrogate-1',
          caseId: 'case-001',
          trusteeId: fingerprint,
          assignedOn: '2024-01-15',
          isSurrogate: true,
          createdOn: '2024-01-01T00:00:00Z',
          createdBy: { id: 'system', name: 'System' },
          updatedOn: '2024-01-01T00:00:00Z',
          updatedBy: { id: 'system', name: 'System' },
        };
        mockTrusteeCaseAppointmentsRepo.getSurrogatesByFingerprint = vi
          .fn()
          .mockResolvedValue([openSurrogate]);

        await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          [event],
        );

        expect(mockTrusteeCaseAppointmentsRepo.upsert).toHaveBeenCalledTimes(1);
        expect(mockTrusteeCaseAppointmentsRepo.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            caseId: 'case-001',
            trusteeId: fingerprint,
            assignedOn: '2024-01-15',
            unassignedOn: '2026-09-01',
          }),
        );
        expect(mockTrusteeCaseAppointmentsRepo.updateCaseAppointment).not.toHaveBeenCalled();
        expect(mockVerificationRepo.upsertVerification).not.toHaveBeenCalled();
      });

      test('ignores a surrogate for a different case on the same fingerprint', async () => {
        (
          pipelineOrchestrator.runTrusteeMatchPipeline as ReturnType<typeof vi.fn>
        ).mockResolvedValueOnce(makeUnresolvedState(0));

        const event = { ...makeEvent('case-001', 'Ghost Trustee'), unassignedOn: '2026-09-01' };
        const variant = buildVariant(event.sourceTrustee);
        const fingerprint = computeFingerprint(variant);
        const otherCaseSurrogate: CaseAppointment = {
          id: 'surrogate-other-case',
          caseId: 'case-999',
          trusteeId: fingerprint,
          assignedOn: '2024-01-15',
          isSurrogate: true,
          createdOn: '2024-01-01T00:00:00Z',
          createdBy: { id: 'system', name: 'System' },
          updatedOn: '2024-01-01T00:00:00Z',
          updatedBy: { id: 'system', name: 'System' },
        };
        mockTrusteeCaseAppointmentsRepo.getSurrogatesByFingerprint = vi
          .fn()
          .mockResolvedValue([otherCaseSurrogate]);

        await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          [event],
        );
        // Falls through to the normal unresolved handling since there was nothing of this
        // fingerprint's own to clean up on this case.
        expect(mockVerificationRepo.upsertVerification).toHaveBeenCalled();
      });

      test('proceeds with normal unresolved handling when there is no existing surrogate to clean up', async () => {
        (
          pipelineOrchestrator.runTrusteeMatchPipeline as ReturnType<typeof vi.fn>
        ).mockResolvedValueOnce(makeUnresolvedState(0));

        const event = { ...makeEvent('case-001', 'Ghost Trustee'), unassignedOn: '2026-09-01' };

        await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          [event],
        );

        expect(mockVerificationRepo.upsertVerification).toHaveBeenCalled();
        expect(mockTrusteeCaseAppointmentsRepo.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            caseId: 'case-001',
            isSurrogate: true,
            unassignedOn: '2026-09-01',
          }),
        );
      });

      test('does not look up surrogates by fingerprint when the event carries no unassignedOn', async () => {
        (
          pipelineOrchestrator.runTrusteeMatchPipeline as ReturnType<typeof vi.fn>
        ).mockResolvedValueOnce(makeUnresolvedState(0));
        const getSurrogatesByFingerprint =
          mockTrusteeCaseAppointmentsRepo.getSurrogatesByFingerprint as ReturnType<typeof vi.fn>;

        await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          [makeEvent('case-001', 'Ghost Trustee')],
        );

        expect(getSurrogatesByFingerprint).not.toHaveBeenCalled();
      });

      test('closes the open surrogate via the verification-bucket-hit short-circuit, not just the pipeline path', async () => {
        // A pending verification bucket (from an earlier unresolved pass) short-circuits
        // processOneEvent BEFORE resolveTrusteeViaPipeline ever runs -- this is the path the real
        // harness scenario actually takes on its second pass, since the first pass's unresolved
        // outcome already created this exact pending bucket entry.
        const event = { ...makeEvent('case-001', 'Ghost Trustee'), unassignedOn: '2026-09-01' };
        const variant = buildVariant(event.sourceTrustee);
        const fingerprint = computeFingerprint(variant);
        (mockVerificationRepo.findByFingerprint as ReturnType<typeof vi.fn>).mockResolvedValue([
          { documentType: 'TRUSTEE_MATCH_VERIFICATION', fingerprint, variant, status: 'pending' },
        ]);
        const openSurrogate: CaseAppointment = {
          id: 'surrogate-1',
          caseId: 'case-001',
          trusteeId: fingerprint,
          assignedOn: '2024-01-15',
          isSurrogate: true,
          createdOn: '2024-01-01T00:00:00Z',
          createdBy: { id: 'system', name: 'System' },
          updatedOn: '2024-01-01T00:00:00Z',
          updatedBy: { id: 'system', name: 'System' },
        };
        mockTrusteeCaseAppointmentsRepo.getSurrogatesByFingerprint = vi
          .fn()
          .mockResolvedValue([openSurrogate]);

        await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          [event],
        );

        expect(mockTrusteeCaseAppointmentsRepo.upsert).toHaveBeenCalledTimes(1);
        expect(mockTrusteeCaseAppointmentsRepo.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            caseId: 'case-001',
            trusteeId: fingerprint,
            assignedOn: '2024-01-15',
            unassignedOn: '2026-09-01',
          }),
        );
        expect(mockTrusteeCaseAppointmentsRepo.updateCaseAppointment).not.toHaveBeenCalled();
        expect(pipelineOrchestrator.runTrusteeMatchPipeline).not.toHaveBeenCalled();
      });

      test('writes the surrogate when a pre-disposed row joins a pending bucket but this case has no surrogate to remove', async () => {
        // The case's first-ever row for this fingerprint arrives already disposed, so there is no
        // open surrogate to remove. Mirrors resolveTrusteeViaPipeline's fallthrough to a surrogate.
        const event = { ...makeEvent('case-001', 'Ghost Trustee'), unassignedOn: '2026-09-01' };
        const variant = buildVariant(event.sourceTrustee);
        const fingerprint = computeFingerprint(variant);
        (mockVerificationRepo.findByFingerprint as ReturnType<typeof vi.fn>).mockResolvedValue([
          { documentType: 'TRUSTEE_MATCH_VERIFICATION', fingerprint, variant, status: 'pending' },
        ]);

        await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          [event],
        );

        expect(pipelineOrchestrator.runTrusteeMatchPipeline).not.toHaveBeenCalled();
        expect(mockTrusteeCaseAppointmentsRepo.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            caseId: 'case-001',
            trusteeId: fingerprint,
            isSurrogate: true,
            unassignedOn: '2026-09-01',
          }),
        );
      });

      test('records a disposition that predates the placeholder assignedOn as given, and warns', async () => {
        (
          pipelineOrchestrator.runTrusteeMatchPipeline as ReturnType<typeof vi.fn>
        ).mockResolvedValueOnce(makeUnresolvedState(0));
        const warnSpy = vi.spyOn(context.logger, 'warn');

        // makeEvent's appointedDate is 2024-01-15, which becomes the placeholder's assignedOn.
        const event = { ...makeEvent('case-001', 'Ghost Trustee'), unassignedOn: '2024-01-01' };

        await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          [event],
        );

        expect(mockTrusteeCaseAppointmentsRepo.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            isSurrogate: true,
            assignedOn: '2024-01-15',
            unassignedOn: '2024-01-01',
          }),
        );
        expect(warnSpy).toHaveBeenCalledWith(
          expect.any(String),
          expect.stringContaining('precedes APPT_DATE'),
        );
      });

      test('re-delivery of a disposed row upserts the same natural key carrying its disposition, deleting nothing', async () => {
        (
          pipelineOrchestrator.runTrusteeMatchPipeline as ReturnType<typeof vi.fn>
        ).mockResolvedValueOnce(makeUnresolvedState(0));

        const event = { ...makeEvent('case-001', 'Ghost Trustee'), unassignedOn: '2026-09-01' };
        const variant = buildVariant(event.sourceTrustee);
        const fingerprint = computeFingerprint(variant);
        const closedSurrogate: CaseAppointment = {
          id: 'surrogate-closed',
          caseId: 'case-001',
          trusteeId: fingerprint,
          assignedOn: '2024-01-15',
          unassignedOn: '2026-09-01',
          isSurrogate: true,
          createdOn: '2024-01-01T00:00:00Z',
          createdBy: { id: 'system', name: 'System' },
          updatedOn: '2024-01-01T00:00:00Z',
          updatedBy: { id: 'system', name: 'System' },
        };
        mockTrusteeCaseAppointmentsRepo.getByCaseId = vi.fn().mockResolvedValue([closedSurrogate]);
        mockTrusteeCaseAppointmentsRepo.getSurrogatesByFingerprint = vi
          .fn()
          .mockResolvedValue([closedSurrogate]);

        await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          [event],
        );

        expect(mockTrusteeCaseAppointmentsRepo.upsert).toHaveBeenCalledTimes(1);
        expect(mockTrusteeCaseAppointmentsRepo.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            caseId: 'case-001',
            trusteeId: fingerprint,
            assignedOn: '2024-01-15',
            unassignedOn: '2026-09-01',
          }),
        );
        expect(mockTrusteeCaseAppointmentsRepo.updateCaseAppointment).not.toHaveBeenCalled();
      });

      test('a later appointment of an already-placeholdered fingerprint writes a second placeholder for its own appointedDate', async () => {
        (
          pipelineOrchestrator.runTrusteeMatchPipeline as ReturnType<typeof vi.fn>
        ).mockResolvedValueOnce(makeUnresolvedState(0));

        const event = { ...makeEvent('case-001', 'Ghost Trustee'), appointedDate: '2026-10-01' };
        const variant = buildVariant(event.sourceTrustee);
        const fingerprint = computeFingerprint(variant);
        const closedSurrogate: CaseAppointment = {
          id: 'surrogate-closed',
          caseId: 'case-001',
          trusteeId: fingerprint,
          assignedOn: '2024-01-15',
          appointedDate: '2024-01-15',
          unassignedOn: '2026-09-01',
          isSurrogate: true,
          createdOn: '2024-01-01T00:00:00Z',
          createdBy: { id: 'system', name: 'System' },
          updatedOn: '2024-01-01T00:00:00Z',
          updatedBy: { id: 'system', name: 'System' },
        };
        mockTrusteeCaseAppointmentsRepo.getByCaseId = vi.fn().mockResolvedValue([closedSurrogate]);

        await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          [event],
        );

        expect(mockTrusteeCaseAppointmentsRepo.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            caseId: 'case-001',
            trusteeId: fingerprint,
            isSurrogate: true,
            assignedOn: '2026-10-01',
          }),
        );
        expect(mockTrusteeCaseAppointmentsRepo.updateCaseAppointment).not.toHaveBeenCalled();
      });

      test('a disposition for a different appointedDate leaves the open placeholder open and records its own closed one', async () => {
        (
          pipelineOrchestrator.runTrusteeMatchPipeline as ReturnType<typeof vi.fn>
        ).mockResolvedValueOnce(makeUnresolvedState(0));

        const event = {
          ...makeEvent('case-001', 'Ghost Trustee'),
          appointedDate: '2026-10-01',
          unassignedOn: '2026-11-01',
        };
        const variant = buildVariant(event.sourceTrustee);
        const fingerprint = computeFingerprint(variant);
        const openSurrogate: CaseAppointment = {
          id: 'surrogate-open',
          caseId: 'case-001',
          trusteeId: fingerprint,
          assignedOn: '2024-01-15',
          appointedDate: '2024-01-15',
          isSurrogate: true,
          createdOn: '2024-01-01T00:00:00Z',
          createdBy: { id: 'system', name: 'System' },
          updatedOn: '2024-01-01T00:00:00Z',
          updatedBy: { id: 'system', name: 'System' },
        };
        mockTrusteeCaseAppointmentsRepo.getSurrogatesByFingerprint = vi
          .fn()
          .mockResolvedValue([openSurrogate]);

        await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          [event],
        );

        expect(mockTrusteeCaseAppointmentsRepo.updateCaseAppointment).not.toHaveBeenCalled();
        expect(mockTrusteeCaseAppointmentsRepo.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            caseId: 'case-001',
            trusteeId: fingerprint,
            assignedOn: '2026-10-01',
            unassignedOn: '2026-11-01',
          }),
        );
      });

      test('does not fire when the pipeline resolves the trustee (handled by cams-fd8qd.1.8 instead)', async () => {
        const getSurrogatesByFingerprint =
          mockTrusteeCaseAppointmentsRepo.getSurrogatesByFingerprint as ReturnType<typeof vi.fn>;
        const existingAppointment: CaseAppointment = {
          id: 'ca-1',
          caseId: 'case-001',
          trusteeId: 'trustee-123',
          assignedOn: '2024-01-15',
          createdOn: '2024-01-01T00:00:00Z',
          createdBy: { id: 'system', name: 'System' },
          updatedOn: '2024-01-01T00:00:00Z',
          updatedBy: { id: 'system', name: 'System' },
        };
        (
          mockTrusteeCaseAppointmentsRepo.getActiveByCaseId as ReturnType<typeof vi.fn>
        ).mockResolvedValue(existingAppointment);

        const event = { ...makeEvent('case-001', 'John Doe'), unassignedOn: '2024-03-01' };

        await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          [event],
        );

        expect(getSurrogatesByFingerprint).not.toHaveBeenCalled();
        expect(mockTrusteeCaseAppointmentsRepo.updateCaseAppointment).toHaveBeenCalledWith(
          expect.objectContaining({ id: 'ca-1', unassignedOn: '2024-03-01' }),
        );
      });
    });

    describe('TrusteeMatchVerification persistence', () => {
      test('upserts verification doc for an ambiguous outcome', async () => {
        (
          pipelineOrchestrator.runTrusteeMatchPipeline as ReturnType<typeof vi.fn>
        ).mockResolvedValueOnce(makeUnresolvedState(2));

        await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          [makeEvent('case-001', 'John Doe')],
        );

        expect(mockVerificationRepo.upsertVerification).toHaveBeenCalledWith(
          expect.objectContaining({
            documentType: 'TRUSTEE_MATCH_VERIFICATION',
            caseId: 'case-001',
            courtId: '081',
            mismatchReason: 'ambiguous',
            source: 'DXTR',
            status: 'pending',
          }),
        );
      });

      // The label depends on how many pooled candidates pass the name check with genuine
      // evidence, not on the pool size: the discovery tiers keep a candidate that fails the name
      // check when its state does not conflict with the source's.
      test.each([
        { candidateCount: 1, nameMatchCount: 1, expectedReason: 'no match' },
        { candidateCount: 2, nameMatchCount: 0, expectedReason: 'no match' },
        { candidateCount: 2, nameMatchCount: 1, expectedReason: 'no match' },
        { candidateCount: 3, nameMatchCount: 1, expectedReason: 'no match' },
        { candidateCount: 2, nameMatchCount: 2, expectedReason: 'ambiguous' },
        { candidateCount: 3, nameMatchCount: 2, expectedReason: 'ambiguous' },
        { candidateCount: 3, nameMatchCount: 3, expectedReason: 'ambiguous' },
      ])(
        "is '$expectedReason' when the pool has $candidateCount candidates and $nameMatchCount pass the name check",
        async ({ candidateCount, nameMatchCount, expectedReason }) => {
          (
            pipelineOrchestrator.runTrusteeMatchPipeline as ReturnType<typeof vi.fn>
          ).mockResolvedValueOnce(makeUnresolvedState(candidateCount, nameMatchCount));

          const { scenarioDistribution } = await SyncTrusteeCaseAppointments.processAppointments(
            SyncTrusteeCaseAppointments.createDeps(context),
            [makeEvent('case-001', 'John Doe')],
          );

          expect(mockVerificationRepo.upsertVerification).toHaveBeenCalledWith(
            expect.objectContaining({ mismatchReason: expectedReason }),
          );
          expect(scenarioDistribution.multipleMatchCount).toBe(
            expectedReason === 'ambiguous' ? 1 : 0,
          );
          expect(scenarioDistribution.noMatchCount).toBe(expectedReason === 'no match' ? 1 : 0);
        },
      );

      test('carries appointedDate from the event onto a new verification doc', async () => {
        (
          pipelineOrchestrator.runTrusteeMatchPipeline as ReturnType<typeof vi.fn>
        ).mockResolvedValueOnce(makeUnresolvedState(0));

        await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          [
            {
              ...makeEvent('case-001', 'John Doe'),
              appointedDate: '2025-06-01',
            },
          ],
        );

        expect(mockVerificationRepo.upsertVerification).toHaveBeenCalledWith(
          expect.objectContaining({
            caseId: 'case-001',
            appointedDate: '2025-06-01',
          }),
        );
      });

      test('does not write a verification doc for a pipeline-resolved trustee — auto-links instead', async () => {
        (
          pipelineOrchestrator.runTrusteeMatchPipeline as ReturnType<typeof vi.fn>
        ).mockResolvedValueOnce(makeResolvedState('t-1'));

        await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          [makeEvent('case-001', 'Common Name')],
        );

        expect(mockVerificationRepo.upsertVerification).not.toHaveBeenCalled();
        expect(mockTrusteeCaseAppointmentsRepo.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            caseId: 'case-001',
            trusteeId: 't-1',
          }),
        );
      });

      test('upserts verification doc for a no-match outcome', async () => {
        (
          pipelineOrchestrator.runTrusteeMatchPipeline as ReturnType<typeof vi.fn>
        ).mockResolvedValueOnce(makeUnresolvedState(0));

        await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          [makeEvent('case-001', 'Ghost Trustee')],
        );

        expect(mockVerificationRepo.upsertVerification).toHaveBeenCalledWith(
          expect.objectContaining({
            documentType: 'TRUSTEE_MATCH_VERIFICATION',
            caseId: 'case-001',
            mismatchReason: 'no match',
            source: 'DXTR',
            status: 'pending',
          }),
        );
      });

      test('does not write a verification doc for an auto-matched outcome', async () => {
        // Auto-matched cases were never reviewed by a human, so nothing belongs in the
        // human-review queue -- writing status: 'approved' here previously mislabeled these as
        // "Verified" in the Data Verification UI even though no one had looked at them.
        await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          [makeEvent('case-001', 'John Doe')],
        );

        expect(mockVerificationRepo.upsertVerification).not.toHaveBeenCalled();
      });

      test('short-circuits on a fingerprint bucket hit whose variant matches and status is pending', async () => {
        const event = makeEvent('case-001', 'John Doe');
        (mockVerificationRepo.findByFingerprint as ReturnType<typeof vi.fn>).mockResolvedValue([
          {
            id: 'existing-doc-id',
            documentType: 'TRUSTEE_MATCH_VERIFICATION',
            caseId: 'case-999', // a different case already pending on this same fingerprint
            status: 'pending',
            mismatchReason: 'no match',
            variant: buildVariant(event.sourceTrustee),
            fingerprint: computeFingerprint(buildVariant(event.sourceTrustee)),
            createdOn: '2025-01-01T00:00:00.000Z',
            createdBy: { id: 'system', name: 'System' },
            updatedOn: '2025-01-01T00:00:00.000Z',
            updatedBy: { id: 'system', name: 'System' },
          },
        ]);

        const { scenarioDistribution, successCount } =
          await SyncTrusteeCaseAppointments.processAppointments(
            SyncTrusteeCaseAppointments.createDeps(context),
            [event],
          );

        expect(pipelineOrchestrator.runTrusteeMatchPipeline).not.toHaveBeenCalled();
        expect(mockVerificationRepo.upsertVerification).not.toHaveBeenCalled();
        expect(mockTrusteeCaseAppointmentsRepo.upsert).toHaveBeenCalledWith(
          expect.objectContaining({ caseId: 'case-001', isSurrogate: true }),
        );
        expect(scenarioDistribution.verificationBucketHitCount).toBe(1);
        expect(successCount).toBe(0);
      });

      test('routes to DLQ instead of writing a surrogate appointment with a malformed chapter', async () => {
        const event: TrusteeAppointmentSyncEvent = {
          ...makeEvent('case-001', 'John Doe'),
          chapter: '7A', // DXTR sub-code, not a valid CaseChapter
        };
        (mockVerificationRepo.findByFingerprint as ReturnType<typeof vi.fn>).mockResolvedValue([
          {
            id: 'existing-doc-id',
            documentType: 'TRUSTEE_MATCH_VERIFICATION',
            caseId: 'case-999',
            status: 'pending',
            mismatchReason: 'no match',
            variant: buildVariant(event.sourceTrustee),
            fingerprint: computeFingerprint(buildVariant(event.sourceTrustee)),
            createdOn: '2025-01-01T00:00:00.000Z',
            createdBy: { id: 'system', name: 'System' },
            updatedOn: '2025-01-01T00:00:00.000Z',
            updatedBy: { id: 'system', name: 'System' },
          },
        ]);

        const { dlqMessages } = await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          [event],
        );

        expect(mockTrusteeCaseAppointmentsRepo.upsert).not.toHaveBeenCalled();
        expect(dlqMessages).toEqual([
          expect.objectContaining({
            error: expect.objectContaining({
              message: expect.stringContaining('Invalid chapter value "7A"'),
            }),
          }),
        ]);
      });

      test('skips upsert when existing doc is resolved', async () => {
        const event = makeEvent('case-001', 'John Doe');
        (mockVerificationRepo.findByFingerprint as ReturnType<typeof vi.fn>).mockResolvedValue([
          {
            documentType: 'TRUSTEE_MATCH_VERIFICATION',
            caseId: 'case-001',
            status: 'approved',
            createdOn: '2025-01-01T00:00:00.000Z',
            updatedOn: '2025-01-01T00:00:00.000Z',
            updatedBy: { id: 'user-1', name: 'Operator' },
            variant: buildVariant(event.sourceTrustee),
            fingerprint: computeFingerprint(buildVariant(event.sourceTrustee)),
          },
        ]);
        (
          pipelineOrchestrator.runTrusteeMatchPipeline as ReturnType<typeof vi.fn>
        ).mockResolvedValueOnce(makeUnresolvedState(2));

        await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          [event],
        );

        expect(mockVerificationRepo.upsertVerification).not.toHaveBeenCalled();
      });

      test('skips upsert when existing doc is dismissed', async () => {
        const event = makeEvent('case-001', 'Ghost');
        (mockVerificationRepo.findByFingerprint as ReturnType<typeof vi.fn>).mockResolvedValue([
          {
            documentType: 'TRUSTEE_MATCH_VERIFICATION',
            caseId: 'case-001',
            status: 'rejected',
            createdOn: '2025-01-01T00:00:00.000Z',
            updatedOn: '2025-01-01T00:00:00.000Z',
            updatedBy: { id: 'user-1', name: 'Operator' },
            variant: buildVariant(event.sourceTrustee),
            fingerprint: computeFingerprint(buildVariant(event.sourceTrustee)),
          },
        ]);
        (
          pipelineOrchestrator.runTrusteeMatchPipeline as ReturnType<typeof vi.fn>
        ).mockResolvedValueOnce(makeUnresolvedState(0));

        await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          [event],
        );

        expect(mockVerificationRepo.upsertVerification).not.toHaveBeenCalled();
      });

      test('sets createdOn and omits updatedBy as SYSTEM for first-time insert', async () => {
        (
          pipelineOrchestrator.runTrusteeMatchPipeline as ReturnType<typeof vi.fn>
        ).mockResolvedValueOnce(makeUnresolvedState(0));

        await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          [makeEvent('case-001', 'Ghost')],
        );

        expect(mockVerificationRepo.upsertVerification).toHaveBeenCalledWith(
          expect.objectContaining({
            createdOn: expect.any(String),
            updatedBy: { id: 'SYSTEM', name: 'SYSTEM' },
          }),
        );
      });
    });

    describe('parsedCityStateZip enrichment', () => {
      // Enrichment mutates event.sourceTrustee.legacy in place before matching runs, so these
      // assert directly on the event object rather than on a downstream repo call — auto-matched
      // outcomes (the default mock setup in this describe block) no longer write a verification
      // doc at all, so that's no longer an available observation point.
      test('populates dxtrTrustee.legacy.parsedCityStateZip when cityStateZipCountry is parseable', async () => {
        const event: TrusteeAppointmentSyncEvent = {
          ...makeEvent('case-001', 'John Doe'),
          sourceTrustee: {
            fullName: 'John Doe',
            legacy: { cityStateZipCountry: 'New York, NY 10001' },
          },
        };

        await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          [event],
        );

        expect(event.sourceTrustee.legacy?.parsedCityStateZip).toEqual({
          city: 'New York',
          state: 'NY',
          zipCode: '10001',
        });
      });

      test('sets dxtrTrustee.legacy.parsedCityStateZip to null when cityStateZipCountry is present but unparseable', async () => {
        const event: TrusteeAppointmentSyncEvent = {
          ...makeEvent('case-001', 'John Doe'),
          sourceTrustee: {
            fullName: 'John Doe',
            legacy: { cityStateZipCountry: 'not a valid address' },
          },
        };

        await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          [event],
        );

        expect(event.sourceTrustee.legacy?.parsedCityStateZip).toBeNull();
      });

      test('leaves dxtrTrustee.legacy.parsedCityStateZip absent when there is no cityStateZipCountry', async () => {
        const event: TrusteeAppointmentSyncEvent = {
          ...makeEvent('case-001', 'John Doe'),
          sourceTrustee: {
            fullName: 'John Doe',
            legacy: { phone: '555-1234' },
          },
        };

        await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          [event],
        );

        expect(event.sourceTrustee.legacy).not.toHaveProperty('parsedCityStateZip');
      });
    });

    describe('surrogate CaseAppointment writes', () => {
      test('writes a surrogate appointment with trusteeId = fingerprint and the raw variant on a NO_TRUSTEE_MATCH outcome', async () => {
        const event = makeEvent('case-001', 'Ghost Trustee');
        (
          pipelineOrchestrator.runTrusteeMatchPipeline as ReturnType<typeof vi.fn>
        ).mockResolvedValueOnce(makeUnresolvedState(0));

        await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          [event],
        );

        const expectedVariant = buildVariant(event.sourceTrustee);
        const expectedFingerprint = computeFingerprint(expectedVariant);
        expect(mockTrusteeCaseAppointmentsRepo.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            caseId: 'case-001',
            trusteeId: expectedFingerprint,
            isSurrogate: true,
            variant: expectedVariant,
          }),
        );
      });

      test('writes a surrogate appointment even when the case already has a real active appointment', async () => {
        // A surrogate is a membership marker for a pending mismatch, not the case's
        // appointment — a case with a verified, active trustee that later receives an
        // unmatched DXTR event must both keep its real trustee AND be recorded as a member
        // of the new pending mismatch.
        const existingAppointment: CaseAppointment = {
          id: 'ca-1',
          caseId: 'case-001',
          trusteeId: 'trustee-existing',
          assignedOn: '2024-01-01T00:00:00Z',
          createdOn: '2024-01-01T00:00:00Z',
          createdBy: { id: 'system', name: 'System' },
          updatedOn: '2024-01-01T00:00:00Z',
          updatedBy: { id: 'system', name: 'System' },
        };
        (mockTrusteeCaseAppointmentsRepo.getByCaseId as ReturnType<typeof vi.fn>).mockResolvedValue(
          [existingAppointment],
        );
        (
          pipelineOrchestrator.runTrusteeMatchPipeline as ReturnType<typeof vi.fn>
        ).mockResolvedValueOnce(makeUnresolvedState(0));

        await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          [makeEvent('case-001', 'Ghost Trustee')],
        );

        expect(mockTrusteeCaseAppointmentsRepo.upsert).toHaveBeenCalledWith(
          expect.objectContaining({ caseId: 'case-001', isSurrogate: true }),
        );
      });

      test('reprocessing the same unresolved event upserts the same natural key both times', async () => {
        const event = makeEvent('case-001', 'Ghost Trustee');
        (
          pipelineOrchestrator.runTrusteeMatchPipeline as ReturnType<typeof vi.fn>
        ).mockResolvedValueOnce(makeUnresolvedState(0));

        await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          [event],
        );
        expect(mockTrusteeCaseAppointmentsRepo.upsert).toHaveBeenCalledTimes(1);

        // Second sync run with the same event.
        (
          pipelineOrchestrator.runTrusteeMatchPipeline as ReturnType<typeof vi.fn>
        ).mockResolvedValueOnce(makeUnresolvedState(0));

        await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          [event],
        );

        const [firstWrite, secondWrite] = (
          mockTrusteeCaseAppointmentsRepo.upsert as ReturnType<typeof vi.fn>
        ).mock.calls.map((call) => call[0]);
        expect(secondWrite).toMatchObject({
          caseId: firstWrite.caseId,
          trusteeId: firstWrite.trusteeId,
          assignedOn: firstWrite.assignedOn,
        });
      });

      test('produces the same assignedOn (and thus one natural-key row, not two) when the same surrogate-triggering event is reprocessed', async () => {
        // Regression test for the double-insert bug: upsert()'s natural key is
        // documentType + caseId + trusteeId + assignedOn. If assignedOn were derived from
        // wall-clock time (the old behavior), reprocessing the identical event would produce a
        // different assignedOn on each call, so the real repository's replaceOne(..., upsert:
        // true) would INSERT a second row instead of replacing the first — leaving two active
        // surrogate appointments for the same fingerprint. Deriving assignedOn from the event's
        // own stable appointedDate means the natural key — and therefore the upsert target — is
        // identical across reprocessing.
        const event: TrusteeAppointmentSyncEvent = {
          ...makeEvent('case-001', 'Ghost Trustee'),
          appointedDate: '2026-04-07',
        };
        (
          pipelineOrchestrator.runTrusteeMatchPipeline as ReturnType<typeof vi.fn>
        ).mockResolvedValue(makeUnresolvedState(0));

        await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          [event],
        );
        await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          [event],
        );

        expect(mockTrusteeCaseAppointmentsRepo.upsert).toHaveBeenCalledTimes(2);
        const [firstCall, secondCall] = (
          mockTrusteeCaseAppointmentsRepo.upsert as ReturnType<typeof vi.fn>
        ).mock.calls;
        const naturalKey = (call: unknown[]) => {
          const arg = call[0] as { caseId: string; trusteeId: string; assignedOn: string };
          return { caseId: arg.caseId, trusteeId: arg.trusteeId, assignedOn: arg.assignedOn };
        };
        expect(naturalKey(firstCall)).toEqual(naturalKey(secondCall));
      });

      test('writes a second surrogate when the case already has a surrogate for a genuinely different fingerprint', async () => {
        const event = makeEvent('case-001', 'Ghost Trustee');
        (mockTrusteeCaseAppointmentsRepo.getByCaseId as ReturnType<typeof vi.fn>).mockResolvedValue(
          [
            {
              id: 'ca-other-surrogate',
              caseId: 'case-001',
              trusteeId: 'a'.repeat(64), // a different fingerprint entirely
              isSurrogate: true,
              variant: 'some other unresolved variant',
              assignedOn: '2026-01-01T00:00:00Z',
              createdOn: '2026-01-01T00:00:00Z',
              createdBy: { id: 'system', name: 'System' },
              updatedOn: '2026-01-01T00:00:00Z',
              updatedBy: { id: 'system', name: 'System' },
            },
          ],
        );
        (
          pipelineOrchestrator.runTrusteeMatchPipeline as ReturnType<typeof vi.fn>
        ).mockResolvedValueOnce(makeUnresolvedState(0));

        await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          [event],
        );

        const expectedFingerprint = computeFingerprint(buildVariant(event.sourceTrustee));
        expect(mockTrusteeCaseAppointmentsRepo.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            caseId: 'case-001',
            trusteeId: expectedFingerprint,
            isSurrogate: true,
          }),
        );
      });
    });

    describe('previously uncovered branches', () => {
      test('should auto-link a pipeline-resolved trustee even when a prior approved verification exists for this fingerprint', async () => {
        // A resolved trustee never calls upsertIdentityTask (it auto-links instead), so a
        // pre-existing approved verification record for this fingerprint/variant has no effect
        // on this event — reVerificationCount stays 0, unlike the ambiguous/no-match outcomes,
        // which still check for and count re-verification of an existing record.
        (
          pipelineOrchestrator.runTrusteeMatchPipeline as ReturnType<typeof vi.fn>
        ).mockResolvedValueOnce(makeResolvedState('t-1'));
        const event = makeEvent('case-001', 'Common Name');
        (mockVerificationRepo.findByFingerprint as ReturnType<typeof vi.fn>).mockResolvedValue([
          {
            documentType: 'TRUSTEE_MATCH_VERIFICATION',
            caseId: 'case-001',
            status: 'approved',
            createdOn: '2025-01-01T00:00:00.000Z',
            updatedOn: '2025-01-01T00:00:00.000Z',
            updatedBy: { id: 'user-1', name: 'Operator' },
            variant: buildVariant(event.sourceTrustee),
            fingerprint: computeFingerprint(buildVariant(event.sourceTrustee)),
          },
        ]);

        const { successCount, scenarioDistribution } =
          await SyncTrusteeCaseAppointments.processAppointments(
            SyncTrusteeCaseAppointments.createDeps(context),
            [event],
          );

        expect(mockVerificationRepo.upsertVerification).not.toHaveBeenCalled();
        expect(successCount).toBe(1);
        expect(scenarioDistribution.reVerificationCount).toBe(0);
        expect(scenarioDistribution.autoMatchCount).toBe(1);
      });

      test('should write the identity task without legacy matchCandidates', async () => {
        (
          pipelineOrchestrator.runTrusteeMatchPipeline as ReturnType<typeof vi.fn>
        ).mockResolvedValueOnce(makeUnresolvedState(2));

        const { dlqMessages } = await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          [makeEvent('case-001', 'Common Name')],
        );

        expect(dlqMessages).toHaveLength(0);
        const [written] = (mockVerificationRepo.upsertVerification as ReturnType<typeof vi.fn>).mock
          .calls[0];
        expect(written).toMatchObject({ mismatchReason: 'ambiguous', source: 'DXTR' });
        expect(written).not.toHaveProperty('matchCandidates');
      });

      test('should track reVerificationCount when an ambiguous outcome is already resolved', async () => {
        (
          pipelineOrchestrator.runTrusteeMatchPipeline as ReturnType<typeof vi.fn>
        ).mockResolvedValueOnce(makeUnresolvedState(2));
        const event = makeEvent('case-001', 'Common Name');
        (mockVerificationRepo.findByFingerprint as ReturnType<typeof vi.fn>).mockResolvedValue([
          {
            documentType: 'TRUSTEE_MATCH_VERIFICATION',
            caseId: 'case-001',
            status: 'approved',
            createdOn: '2025-01-01T00:00:00.000Z',
            updatedOn: '2025-01-01T00:00:00.000Z',
            updatedBy: { id: 'user-1', name: 'Operator' },
            variant: buildVariant(event.sourceTrustee),
            fingerprint: computeFingerprint(buildVariant(event.sourceTrustee)),
          },
        ]);

        const { scenarioDistribution } = await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          [event],
        );

        expect(scenarioDistribution.reVerificationCount).toBe(1);
        expect(scenarioDistribution.multipleMatchCount).toBe(1);
      });
    });

    test('should track reVerificationCount for NO_TRUSTEE_MATCH when already resolved', async () => {
      const event = makeEvent('case-001', 'Ghost Trustee');
      (mockVerificationRepo.findByFingerprint as ReturnType<typeof vi.fn>).mockResolvedValue([
        {
          documentType: 'TRUSTEE_MATCH_VERIFICATION',
          caseId: 'case-001',
          status: 'approved',
          createdOn: '2025-01-01T00:00:00.000Z',
          updatedOn: '2025-01-01T00:00:00.000Z',
          updatedBy: { id: 'user-1', name: 'Operator' },
          variant: buildVariant(event.sourceTrustee),
          fingerprint: computeFingerprint(buildVariant(event.sourceTrustee)),
        },
      ]);
      (
        pipelineOrchestrator.runTrusteeMatchPipeline as ReturnType<typeof vi.fn>
      ).mockResolvedValueOnce(makeUnresolvedState(0));

      const { scenarioDistribution } = await SyncTrusteeCaseAppointments.processAppointments(
        SyncTrusteeCaseAppointments.createDeps(context),
        [event],
      );

      expect(scenarioDistribution.reVerificationCount).toBe(1);
      expect(scenarioDistribution.noMatchCount).toBe(1);
    });
  });

  describe('deleteAppointments', () => {
    let context: ApplicationContext;
    let mockCaseAppointmentsRepo: { deleteCaseAppointments: ReturnType<typeof vi.fn> };
    let mockRegionStateRepo: {
      read: ReturnType<typeof vi.fn>;
      setField: ReturnType<typeof vi.fn>;
    };

    const office = (regionId: string, divisionCodes: string[]) => ({
      regionId,
      groups: [{ divisions: divisionCodes.map((divisionCode) => ({ divisionCode })) }],
    });

    beforeEach(async () => {
      vi.restoreAllMocks();
      if (context) await closeDeferred(context);
      context = await createMockApplicationContext();

      mockCaseAppointmentsRepo = { deleteCaseAppointments: vi.fn().mockResolvedValue(3) };
      mockRegionStateRepo = {
        read: vi.fn().mockResolvedValue({
          documentType: 'TRUSTEE_APPOINTMENT_REGION_SYNC_STATE',
          region: {
            '02': { lastSyncDate: '2026-09-15' },
            '03': { lastSyncDate: '2026-07-20' },
          },
        }),
        setField: vi.fn().mockResolvedValue(undefined),
      };

      vi.spyOn(factory, 'getTrusteeCaseAppointmentsRepository').mockReturnValue(
        mockCaseAppointmentsRepo as unknown as TrusteeCaseAppointmentsRepository,
      );
      vi.spyOn(factory, 'getRuntimeStateRepository').mockReturnValue(
        mockRegionStateRepo as unknown as RuntimeStateRepository<TrusteeAppointmentRegionSyncState>,
      );
      vi.spyOn(factory, 'getOfficesGateway').mockReturnValue({
        // Region 2 has two offices; '2' is un-padded the way the DXTR offices gateway returns it.
        getOffices: vi
          .fn()
          .mockResolvedValue([
            office('2', ['081', '087']),
            office('02', ['087']),
            office('03', ['091']),
          ]),
      } as unknown as ReturnType<typeof factory.getOfficesGateway>);
    });

    const deleteAppointments = (
      options: Parameters<typeof SyncTrusteeCaseAppointments.deleteAppointments>[1],
    ) =>
      SyncTrusteeCaseAppointments.deleteAppointments(
        SyncTrusteeCaseAppointments.createDeps(context),
        options,
      );

    test('with no bounds, deletes every appointment and clears every region bookmark', async () => {
      const result = await deleteAppointments({});

      expect(result).toEqual({ data: { deleted: 3 } });
      expect(mockCaseAppointmentsRepo.deleteCaseAppointments).toHaveBeenCalledWith({});
      expect(mockRegionStateRepo.setField.mock.calls).toEqual([
        ['TRUSTEE_APPOINTMENT_REGION_SYNC_STATE', 'region.02.lastSyncDate', null],
        ['TRUSTEE_APPOINTMENT_REGION_SYNC_STATE', 'region.03.lastSyncDate', null],
      ]);
    });

    test("limits the delete to the named regions' divisions and the given dates", async () => {
      await deleteAppointments({ regions: ['02'], from: '2026-08-01', to: '2026-08-31' });

      expect(mockCaseAppointmentsRepo.deleteCaseAppointments).toHaveBeenCalledWith({
        divisionCodes: ['081', '087'],
        from: '2026-08-01',
        to: '2026-08-31',
      });
    });

    test("rewinds a named region's bookmark to the day before the start date, leaving other regions alone", async () => {
      // Region 03's bookmark would be rewound too if it were named; only the region filter spares it.
      mockRegionStateRepo.read.mockResolvedValue({
        documentType: 'TRUSTEE_APPOINTMENT_REGION_SYNC_STATE',
        region: {
          '02': { lastSyncDate: '2026-09-15' },
          '03': { lastSyncDate: '2026-09-15' },
        },
      });

      await deleteAppointments({ regions: ['02'], from: '2026-08-01' });

      expect(mockRegionStateRepo.setField.mock.calls).toEqual([
        ['TRUSTEE_APPOINTMENT_REGION_SYNC_STATE', 'region.02.lastSyncDate', '2026-07-31'],
      ]);
    });

    test('never moves a bookmark that is already before the start date', async () => {
      await deleteAppointments({ from: '2026-08-01' });

      // Region 03's bookmark (2026-07-20) already precedes 2026-08-01.
      expect(mockRegionStateRepo.setField.mock.calls).toEqual([
        ['TRUSTEE_APPOINTMENT_REGION_SYNC_STATE', 'region.02.lastSyncDate', '2026-07-31'],
      ]);
    });

    test('deletes with no bookmark to rewind when the region state does not exist yet', async () => {
      mockRegionStateRepo.read.mockRejectedValue(new NotFoundError('TEST'));

      const result = await deleteAppointments({ from: '2026-08-01' });

      expect(mockRegionStateRepo.setField).not.toHaveBeenCalled();
      expect(result).toEqual({ data: { deleted: 3 } });
    });

    test('returns an error without deleting when a bookmark rewind fails', async () => {
      mockRegionStateRepo.setField.mockRejectedValueOnce(new Error('Mongo write failed'));
      const camsErrorSpy = vi.spyOn(context.logger, 'camsError');

      const result = await deleteAppointments({ regions: ['02'], from: '2026-08-01' });

      expect(mockCaseAppointmentsRepo.deleteCaseAppointments).not.toHaveBeenCalled();
      expect(result.data).toEqual({ deleted: 0 });
      expect(result.error?.message).toContain('Failed to delete case appointments');
      expect(camsErrorSpy).toHaveBeenCalledTimes(1);
    });

    // Bookmarks are rewound before the delete, so a failed delete leaves them rewound and the next
    // run re-reads and rewrites the rows -- harmless.
    test('returns an error when the delete fails, with the bookmarks already rewound', async () => {
      mockCaseAppointmentsRepo.deleteCaseAppointments.mockRejectedValueOnce(
        new Error('Cosmos delete failed'),
      );
      const camsErrorSpy = vi.spyOn(context.logger, 'camsError');

      const result = await deleteAppointments({ regions: ['02'], from: '2026-08-01' });

      expect(mockRegionStateRepo.setField).toHaveBeenCalledWith(
        'TRUSTEE_APPOINTMENT_REGION_SYNC_STATE',
        'region.02.lastSyncDate',
        '2026-07-31',
      );
      expect(result.data).toEqual({ deleted: 0 });
      expect(result.error?.message).toContain('Failed to delete case appointments');
      expect(camsErrorSpy).toHaveBeenCalledTimes(1);
    });

    // Deleting without rewinding would leave the deleted rows unrecoverable by the next run.
    test('returns an error without deleting when the region state cannot be read', async () => {
      mockRegionStateRepo.read.mockRejectedValue(new Error('Mongo read failed'));

      const result = await deleteAppointments({ regions: ['02'], from: '2026-08-01' });

      expect(mockCaseAppointmentsRepo.deleteCaseAppointments).not.toHaveBeenCalled();
      expect(result.error?.message).toContain('Failed to delete case appointments');
    });

    test('does not create a bookmark for a named region that has never synced', async () => {
      await deleteAppointments({ regions: ['04'], from: '2026-08-01' });

      expect(mockRegionStateRepo.setField).not.toHaveBeenCalled();
    });

    test('leaves a bookmark that is already the day before the start date', async () => {
      mockRegionStateRepo.read.mockResolvedValue({
        documentType: 'TRUSTEE_APPOINTMENT_REGION_SYNC_STATE',
        region: { '02': { lastSyncDate: '2026-07-31' } },
      });

      await deleteAppointments({ regions: ['02'], from: '2026-08-01' });

      expect(mockRegionStateRepo.setField).not.toHaveBeenCalled();
    });
  });
});

describe('assertSyncedCase', () => {
  const syncedCase = {
    caseId: 'case-001',
    courtId: '081',
    courtDivisionCode: '081',
    chapter: '7',
    dateFiled: '2026-01-07',
  } as unknown as SyncedCase;

  test('throws a BadRequestError when syncedCase is undefined', () => {
    expect(() => assertSyncedCase(undefined)).toThrow(BadRequestError);
  });

  test('returns the input unchanged when syncedCase is defined', () => {
    expect(assertSyncedCase(syncedCase)).toBe(syncedCase);
  });
});

describe('throwIfTransientSoftCloseFailure', () => {
  const event: TrusteeAppointmentSyncEvent = {
    caseId: 'case-001',
    courtId: '081',
    courtDivisionCode: '081',
    chapter: '7',
    source: 'DXTR',
    sourceTrustee: { fullName: 'Jane Doe' },
  };
  const existingAppointment = {
    caseId: 'case-001',
    trusteeId: 'old-trustee-456',
    assignedOn: '2023-01-01T00:00:00.000Z',
  } as unknown as CaseAppointment;

  test('throws the softCloseError when it is a TooManyRequestsError', async () => {
    const context = await createMockApplicationContext();
    const softCloseError = new TooManyRequestsError('COSMOS');

    expect(() =>
      throwIfTransientSoftCloseFailure(
        context,
        event,
        existingAppointment,
        'new-trustee-789',
        softCloseError,
      ),
    ).toThrow(softCloseError);
  });

  test('throws the softCloseError when it is a GatewayTimeoutError', async () => {
    const context = await createMockApplicationContext();
    const softCloseError = new GatewayTimeoutError('COSMOS');

    expect(() =>
      throwIfTransientSoftCloseFailure(
        context,
        event,
        existingAppointment,
        'new-trustee-789',
        softCloseError,
      ),
    ).toThrow(softCloseError);
  });

  test('logs a warning before throwing a transient softCloseError', async () => {
    const context = await createMockApplicationContext();
    const warnSpy = vi.spyOn(context.logger, 'warn');
    const softCloseError = new TooManyRequestsError('COSMOS');

    expect(() =>
      throwIfTransientSoftCloseFailure(
        context,
        event,
        existingAppointment,
        'new-trustee-789',
        softCloseError,
      ),
    ).toThrow();

    expect(warnSpy).toHaveBeenCalledWith(
      'SYNC-TRUSTEE-CASE-APPOINTMENTS-USE-CASE',
      expect.stringContaining('Transient soft-close failure'),
      expect.objectContaining({
        caseId: 'case-001',
        oldTrusteeId: 'old-trustee-456',
        newTrusteeId: 'new-trustee-789',
      }),
    );
  });

  test('does not throw when the softCloseError is not transient', async () => {
    const context = await createMockApplicationContext();
    const softCloseError = new CamsError('TEST', { message: 'permanent failure' });

    expect(() =>
      throwIfTransientSoftCloseFailure(
        context,
        event,
        existingAppointment,
        'new-trustee-789',
        softCloseError,
      ),
    ).not.toThrow();
  });

  test('logs a null newTrusteeId when called from the close-only path', async () => {
    // handleBogusTrusteeCloseOnly passes null — there is no replacement trustee to log.
    const context = await createMockApplicationContext();
    const warnSpy = vi.spyOn(context.logger, 'warn');
    const softCloseError = new TooManyRequestsError('COSMOS');

    expect(() =>
      throwIfTransientSoftCloseFailure(context, event, existingAppointment, null, softCloseError),
    ).toThrow(softCloseError);

    expect(warnSpy).toHaveBeenCalledWith(
      'SYNC-TRUSTEE-CASE-APPOINTMENTS-USE-CASE',
      expect.stringContaining('Transient soft-close failure'),
      expect.objectContaining({
        caseId: 'case-001',
        oldTrusteeId: 'old-trustee-456',
        newTrusteeId: null,
      }),
    );
  });
});

const fixtureChecks: CaseAppointmentChecks = {
  matchedCase: true,
  matchedTrustee: true,
  matchedTrusteeAppointment: true,
  matchedBy: 'resolveByPhone',
};

describe('createNewAppointment', () => {
  test('upserts the new appointment (with checks) and logs an info message', async () => {
    const context = await createMockApplicationContext();
    const infoSpy = vi.spyOn(context.logger, 'info');
    const upsert = vi.fn().mockResolvedValue({});
    const appointmentsRepo = { upsert } as unknown as TrusteeCaseAppointmentsRepository;
    const event: TrusteeAppointmentSyncEvent = {
      caseId: 'case-001',
      courtId: '081',
      courtDivisionCode: '081',
      chapter: '7',
      appointedDate: '2023-01-02T00:00:00.000Z',
      source: 'DXTR',
      sourceTrustee: { fullName: 'Jane Doe' },
    };

    await createNewAppointment(
      context,
      appointmentsRepo,
      event,
      'new-trustee-789',
      '2023-01-02T00:00:00.000Z',
      fixtureChecks,
    );

    expect(upsert).toHaveBeenCalledWith({
      caseId: 'case-001',
      trusteeId: 'new-trustee-789',
      assignedOn: '2023-01-02T00:00:00.000Z',
      appointedDate: '2023-01-02T00:00:00.000Z',
      courtId: '081',
      courtDivisionCode: '081',
      chapter: '7',
      checks: fixtureChecks,
    });
    expect(infoSpy).toHaveBeenCalledWith(
      'SYNC-TRUSTEE-CASE-APPOINTMENTS-USE-CASE',
      'Created case appointment for case case-001, trustee new-trustee-789',
    );
  });
});

// Shared by closeExistingAppointment and softCloseExistingAppointment below — both exercise the
// same close mechanics (see closeExistingAppointment's docblock for how the two differ).
const closeFixtureEvent: TrusteeAppointmentSyncEvent = {
  caseId: 'case-001',
  courtId: '081',
  courtDivisionCode: '081',
  chapter: '7',
  appointedDate: '2023-01-02',
  source: 'DXTR',
  sourceTrustee: { fullName: 'Jane Doe' },
};
const closeFixtureExistingAppointment = {
  caseId: 'case-001',
  trusteeId: 'old-trustee-456',
  assignedOn: '2023-01-01T00:00:00.000Z',
} as unknown as CaseAppointment;

function buildCloseFixtureAppointmentsRepo(
  overrides: Partial<TrusteeCaseAppointmentsRepository> = {},
) {
  return {
    updateCaseAppointment: vi.fn().mockResolvedValue({}),
    upsert: vi.fn().mockResolvedValue({}),
    ...overrides,
  } as unknown as TrusteeCaseAppointmentsRepository;
}

describe('closeExistingAppointment', () => {
  const event = closeFixtureEvent;
  const existingAppointment = closeFixtureExistingAppointment;
  const buildAppointmentsRepo = buildCloseFixtureAppointmentsRepo;

  test('closes with unassignedOn one day before referenceDate and reports closed:true', async () => {
    const context = await createMockApplicationContext();
    const appointmentsRepo = buildAppointmentsRepo();

    const result = await closeExistingAppointment(
      context,
      event,
      existingAppointment,
      '2024-06-15',
      appointmentsRepo,
    );

    expect(appointmentsRepo.updateCaseAppointment).toHaveBeenCalledWith({
      ...existingAppointment,
      unassignedOn: '2024-06-14',
    });
    expect(appointmentsRepo.upsert).not.toHaveBeenCalled();
    expect(result).toEqual({ closed: true, softCloseError: null, unassignedOn: '2024-06-14' });
  });

  test('correctly rolls back across a year boundary when referenceDate is January 1st', async () => {
    // Every other unassignedOn-derivation test in this file uses a safe mid-month referenceDate —
    // this guards month/year rollover specifically, since deriveUnassignedOn's correctness (not
    // just wall-clock time) is this change's central claim.
    const context = await createMockApplicationContext();
    const appointmentsRepo = buildAppointmentsRepo();

    const result = await closeExistingAppointment(
      context,
      event,
      existingAppointment,
      '2024-01-01',
      appointmentsRepo,
    );

    expect(appointmentsRepo.updateCaseAppointment).toHaveBeenCalledWith({
      ...existingAppointment,
      unassignedOn: '2023-12-31',
    });
    expect(result.unassignedOn).toBe('2023-12-31');
  });

  test('clamps unassignedOn to existingAssignedOn when referenceDate precedes it (out-of-order delivery)', async () => {
    // existingAppointment.assignedOn is '2023-01-01...'. A referenceDate strictly before that
    // (DLQ redelivery, backfill, or retry delivering an older event after a newer one) would
    // otherwise compute unassignedOn < assignedOn — a row marked closed before it was ever
    // opened. Clamping to existingAssignedOn caps the damage at a zero-duration appointment
    // instead of a negative-duration one.
    const context = await createMockApplicationContext();
    const appointmentsRepo = buildAppointmentsRepo();

    const result = await closeExistingAppointment(
      context,
      event,
      existingAppointment,
      '2022-06-15',
      appointmentsRepo,
    );

    expect(appointmentsRepo.updateCaseAppointment).toHaveBeenCalledWith({
      ...existingAppointment,
      unassignedOn: '2023-01-01',
    });
    expect(result.unassignedOn).toBe('2023-01-01');
  });

  test('never creates a replacement appointment, even on a permanent close failure', async () => {
    const context = await createMockApplicationContext();
    const appointmentsRepo = buildAppointmentsRepo({
      updateCaseAppointment: vi.fn().mockRejectedValue(new Error('permanent failure')),
    });

    const result = await closeExistingAppointment(
      context,
      event,
      existingAppointment,
      '2024-06-15',
      appointmentsRepo,
    );

    expect(appointmentsRepo.upsert).not.toHaveBeenCalled();
    expect(result.closed).toBe(false);
    expect(result.softCloseError).toBeInstanceOf(Error);
  });

  test('propagates a transient close failure without creating anything', async () => {
    const context = await createMockApplicationContext();
    const appointmentsRepo = buildAppointmentsRepo({
      updateCaseAppointment: vi.fn().mockRejectedValue(new TooManyRequestsError('COSMOS')),
    });

    const result = await closeExistingAppointment(
      context,
      event,
      existingAppointment,
      '2024-06-15',
      appointmentsRepo,
    );

    // closeExistingAppointment reports the error rather than throwing — throwing on transient
    // errors is throwIfTransientSoftCloseFailure's job, invoked by each of this primitive's two
    // callers so they can each decide what "abort" means for their own flow.
    expect(result.closed).toBe(false);
    expect(result.softCloseError).toBeInstanceOf(TooManyRequestsError);
    expect(appointmentsRepo.upsert).not.toHaveBeenCalled();
  });
});

describe('softCloseExistingAppointment', () => {
  const event = closeFixtureEvent;
  const existingAppointment = closeFixtureExistingAppointment;
  const buildAppointmentsRepo = buildCloseFixtureAppointmentsRepo;

  test('soft-closes the old appointment and reports closed:true without creating the new one', async () => {
    const context = await createMockApplicationContext();
    const appointmentsRepo = buildAppointmentsRepo();

    const result = await softCloseExistingAppointment(
      context,
      event,
      existingAppointment,
      'new-trustee-789',
      '2023-01-02T00:00:00.000Z',
      appointmentsRepo,
      fixtureChecks,
    );

    expect(appointmentsRepo.updateCaseAppointment).toHaveBeenCalledWith({
      ...existingAppointment,
      // One day before the incoming assignedOn ('2023-01-02...') — never wall-clock time.
      unassignedOn: '2023-01-01',
    });
    // The new appointment is created by the caller (applyResolvedTrustee) once closed:true is
    // reported, not by this helper — mirrors the pre-extraction control flow exactly.
    expect(appointmentsRepo.upsert).not.toHaveBeenCalled();
    expect(result).toEqual({ closed: true, dlqFailure: null });
  });

  test('throws when the soft-close failure is transient', async () => {
    const context = await createMockApplicationContext();
    const appointmentsRepo = buildAppointmentsRepo({
      updateCaseAppointment: vi.fn().mockRejectedValue(new TooManyRequestsError('COSMOS')),
    });

    await expect(
      softCloseExistingAppointment(
        context,
        event,
        existingAppointment,
        'new-trustee-789',
        '2023-01-02T00:00:00.000Z',
        appointmentsRepo,
        fixtureChecks,
      ),
    ).rejects.toThrow();

    expect(appointmentsRepo.upsert).not.toHaveBeenCalled();
  });

  test('creates the new appointment and returns a SoftCloseWriteFailed dlqFailure on a permanent soft-close failure', async () => {
    const context = await createMockApplicationContext();
    const errorSpy = vi.spyOn(context.logger, 'error');
    const appointmentsRepo = buildAppointmentsRepo({
      updateCaseAppointment: vi.fn().mockRejectedValue(new Error('permanent failure')),
    });

    const result = await softCloseExistingAppointment(
      context,
      event,
      existingAppointment,
      'new-trustee-789',
      '2023-01-02T00:00:00.000Z',
      appointmentsRepo,
      fixtureChecks,
    );

    expect(appointmentsRepo.upsert).toHaveBeenCalledWith({
      caseId: 'case-001',
      trusteeId: 'new-trustee-789',
      assignedOn: '2023-01-02T00:00:00.000Z',
      appointedDate: '2023-01-02',
      courtId: '081',
      courtDivisionCode: '081',
      chapter: '7',
      checks: fixtureChecks,
    });
    expect(result.closed).toBe(false);
    expect(result.dlqFailure).toEqual(
      expect.objectContaining({
        caseId: 'case-001',
        mismatchReason: 'SOFT_CLOSE_WRITE_FAILED',
      }),
    );
    expect(errorSpy).toHaveBeenCalledWith(
      'SYNC-TRUSTEE-CASE-APPOINTMENTS-USE-CASE',
      expect.stringContaining('Soft-close failed'),
      expect.any(Object),
    );
  });

  test('writes the replacement closed at the incoming disposition as given, on a permanent soft-close failure', async () => {
    const context = await createMockApplicationContext();
    const appointmentsRepo = buildAppointmentsRepo({
      updateCaseAppointment: vi.fn().mockRejectedValue(new Error('permanent failure')),
    });

    // The disposition (2023-01-01) predates the incoming assignedOn (2023-01-02); it is still
    // recorded exactly as given.
    await softCloseExistingAppointment(
      context,
      { ...event, unassignedOn: '2023-01-01' },
      existingAppointment,
      'new-trustee-789',
      '2023-01-02T00:00:00.000Z',
      appointmentsRepo,
      fixtureChecks,
    );

    expect(appointmentsRepo.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ trusteeId: 'new-trustee-789', unassignedOn: '2023-01-01' }),
    );
  });
});
