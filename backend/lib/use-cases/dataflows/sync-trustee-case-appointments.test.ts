import { vi, describe, test, expect, beforeEach } from 'vitest';
import { ApplicationContext } from '../../adapters/types/basic';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import SyncTrusteeCaseAppointments, {
  assertSyncedCase,
  throwIfTransientSoftCloseFailure,
  createNewAppointment,
  softCloseExistingAppointment,
  isTransientInfraError,
  handleClassifiedMismatch,
} from './sync-trustee-case-appointments';
import factory from '../../factory';
import {
  TrusteeAppointmentSyncEvent,
  TrusteeAppointmentDownstreamEvent,
  TrusteeAppointmentSyncErrorCode,
  CandidateScore,
} from '@common/cams/dataflow-events';
import { CaseAppointment, TrusteeAppointment } from '@common/cams/trustee-appointments';
import {
  ApiToDataflowsGateway,
  CasesRepository,
  RuntimeStateRepository,
  TrusteeAppointmentsRepository,
  TrusteeCaseAppointmentsRepository,
  TrusteeAppointmentsSyncState,
  TrusteePetitionSyncState,
  TrusteeMatchVerificationRepository,
  TrusteesRepository,
  TrusteeProfessionalIdsRepository,
  TrusteeVariationRepository,
} from '../gateways.types';
import * as trusteeMatchHelpers from './trustee-match.helpers';
import { buildVariant, computeFingerprint } from './trustee-variant.helpers';
import { closeDeferred } from '../../deferrable/defer-close';
import { CamsError } from '../../common-errors/cams-error';
import { NotFoundError } from '../../common-errors/not-found-error';
import { TooManyRequestsError } from '../../common-errors/too-many-requests-error';
import { GatewayTimeoutError } from '../../common-errors/gateway-timeout';
import { CasesInterface } from '../cases/cases.interface';
import { MOCKED_USTP_OFFICES_ARRAY } from '@common/cams/test-utilities/offices.mock';
import { BadRequestError } from '../../common-errors/bad-request';
import { SyncedCase } from '@common/cams/cases';

describe('SyncTrusteeCaseAppointments', () => {
  describe('processAppointments', () => {
    let context: ApplicationContext;
    let mockCasesRepo: Partial<CasesRepository>;
    let mockAppointmentsRepo: Partial<TrusteeAppointmentsRepository>;
    let mockTrusteeCaseAppointmentsRepo: Partial<TrusteeCaseAppointmentsRepository>;
    let mockTrusteesRepo: Partial<TrusteesRepository>;
    let mockVerificationRepo: Partial<TrusteeMatchVerificationRepository>;
    let mockVariationRepo: Partial<TrusteeVariationRepository>;

    const makeEvent = (caseId: string, fullName: string): TrusteeAppointmentSyncEvent => {
      const [firstName, ...rest] = fullName.split(' ');
      return {
        caseId,
        courtId: '081',
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
        dxtrTrustee: { fullName, firstName, lastName: rest.join(' ') || undefined },
      };
    };

    const defaultMatchCandidates = [
      {
        trusteeId: 't-1',
        trusteeName: 'T1',
        totalScore: -1,
        addressScore: -1,
        nameScore: -1,
        phoneScore: -1,
        emailScore: -1,
        districtDivisionScore: -1,
        chapterScore: -1,
      },
      {
        trusteeId: 't-2',
        trusteeName: 'T2',
        totalScore: -1,
        addressScore: -1,
        nameScore: -1,
        phoneScore: -1,
        emailScore: -1,
        districtDivisionScore: -1,
        chapterScore: -1,
      },
    ];

    function makeAmbiguousNameMatch(
      candidates = defaultMatchCandidates,
    ): trusteeMatchHelpers.NameMatchResult {
      return { kind: 'ambiguous', matchCandidates: candidates };
    }

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
        getTrusteeAppointments: vi.fn().mockResolvedValue([]),
        release: vi.fn(),
      };

      mockTrusteeCaseAppointmentsRepo = {
        getActiveByCaseId: vi.fn().mockResolvedValue(null),
        getByCaseId: vi.fn().mockResolvedValue([]),
        upsert: vi.fn().mockResolvedValue({}),
        updateCaseAppointment: vi.fn().mockResolvedValue({}),
        findStrandedActiveInTrusteePartition: vi.fn().mockResolvedValue(null),
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
      vi.spyOn(factory, 'getTrusteeProfessionalIdsRepository').mockReturnValue({
        findByCamsTrusteeId: vi.fn().mockResolvedValue([]),
        findByAcmsProfessionalId: vi.fn().mockResolvedValue([]),
        release: vi.fn(),
      } as unknown as TrusteeProfessionalIdsRepository);
      vi.spyOn(factory, 'getOfficesGateway').mockReturnValue({
        getOffices: vi.fn().mockResolvedValue(MOCKED_USTP_OFFICES_ARRAY),
        getOfficeName: vi.fn(),
      });
      vi.spyOn(factory, 'getApiToDataflowsGateway').mockReturnValue({
        queueTrusteeAppointmentEvent: vi.fn().mockResolvedValue(undefined),
        queueCaseAssignmentEvent: vi.fn().mockResolvedValue(undefined),
        queueCaseReload: vi.fn().mockResolvedValue(undefined),
        queueTrusteeVerificationRemap: vi.fn().mockResolvedValue(undefined),
      } as ApiToDataflowsGateway);
      vi.spyOn(trusteeMatchHelpers, 'matchTrusteeByName').mockResolvedValue({
        kind: 'resolved',
        trusteeId: 'trustee-123',
      });
      vi.spyOn(trusteeMatchHelpers, 'isAppointmentMatch').mockReturnValue(true);
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
      expect(scenarioDistribution.imperfectMatchCount).toBe(0);
      expect(scenarioDistribution.highConfidenceMatchCount).toBe(0);
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

    test('does nothing further when the same trustee is already active in both partitions', async () => {
      const existingAppointment: CaseAppointment = {
        id: 'ca-1',
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
      ).mockResolvedValue(existingAppointment);
      const existsInTrusteePartition = vi.fn().mockResolvedValue(true);
      mockTrusteeCaseAppointmentsRepo.existsInTrusteePartition = existsInTrusteePartition;
      const replaceOneInTrusteePartition = vi.fn();
      mockTrusteeCaseAppointmentsRepo.replaceOneInTrusteePartition = replaceOneInTrusteePartition;

      const { successCount } = await SyncTrusteeCaseAppointments.processAppointments(
        SyncTrusteeCaseAppointments.createDeps(context),
        [makeEvent('case-001', 'John Doe')],
      );

      expect(existsInTrusteePartition).toHaveBeenCalledWith(
        'case-001',
        'trustee-123',
        '2024-01-01',
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
        assignedOn: '2024-01-01',
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
      const replaceOneInTrusteePartition = vi.fn().mockResolvedValue(undefined);
      mockTrusteeCaseAppointmentsRepo.replaceOneInTrusteePartition = replaceOneInTrusteePartition;
      const errorSpy = vi.spyOn(context.logger, 'error');

      const { successCount } = await SyncTrusteeCaseAppointments.processAppointments(
        SyncTrusteeCaseAppointments.createDeps(context),
        [makeEvent('case-001', 'John Doe')],
      );

      expect(existsInTrusteePartition).toHaveBeenCalledWith(
        'case-001',
        'trustee-123',
        '2024-01-01',
      );
      expect(replaceOneInTrusteePartition).toHaveBeenCalledWith(
        { caseId: 'case-001', trusteeId: 'trustee-123', assignedOn: '2024-01-01' },
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
      const replaceOneInTrusteePartition = vi.fn().mockResolvedValue(undefined);
      mockTrusteeCaseAppointmentsRepo.replaceOneInTrusteePartition = replaceOneInTrusteePartition;
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

    test('does not repair trusteePartition when no stranded row exists for this case', async () => {
      (
        mockTrusteeCaseAppointmentsRepo.getActiveByCaseId as ReturnType<typeof vi.fn>
      ).mockResolvedValue(null);
      const findStrandedActiveInTrusteePartition = vi.fn().mockResolvedValue(null);
      mockTrusteeCaseAppointmentsRepo.findStrandedActiveInTrusteePartition =
        findStrandedActiveInTrusteePartition;
      const replaceOneInTrusteePartition = vi.fn();
      mockTrusteeCaseAppointmentsRepo.replaceOneInTrusteePartition = replaceOneInTrusteePartition;

      await SyncTrusteeCaseAppointments.processAppointments(
        SyncTrusteeCaseAppointments.createDeps(context),
        [makeEvent('case-001', 'John Doe')],
      );

      expect(findStrandedActiveInTrusteePartition).toHaveBeenCalledWith('case-001', 'trustee-123');
      expect(replaceOneInTrusteePartition).not.toHaveBeenCalled();
    });

    test('should collect a not-yet-synced outcome (not DLQ, not thrown) when getCaseOrMovedCase returns null', async () => {
      (mockCasesRepo.getCaseOrMovedCase as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const events = [makeEvent('case-001', 'John Doe')];
      const { dlqMessages, notYetSyncedEvents, successCount } =
        await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          events,
        );

      expect(dlqMessages).toHaveLength(0);
      expect(successCount).toBe(0);
      expect(notYetSyncedEvents).toEqual([events[0]]);
      expect(mockTrusteeCaseAppointmentsRepo.upsert).not.toHaveBeenCalled();
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
      const { dlqMessages, notYetSyncedEvents, successCount } =
        await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          events,
        );

      expect(dlqMessages).toHaveLength(0);
      expect(notYetSyncedEvents).toHaveLength(0);
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

    test('resolves trusteeId via professional-ID lookup when event.acmsProfessionalId has exactly one match, skipping name matching', async () => {
      const professionalIdsRepo = factory.getTrusteeProfessionalIdsRepository(context);
      (professionalIdsRepo.findByAcmsProfessionalId as ReturnType<typeof vi.fn>).mockResolvedValue([
        { camsTrusteeId: 'trustee-999', acmsProfessionalId: '081-00123' },
      ]);

      const events: TrusteeAppointmentSyncEvent[] = [
        { ...makeEvent('case-001', 'John Doe'), acmsProfessionalId: '081-00123' },
      ];

      await SyncTrusteeCaseAppointments.processAppointments(
        SyncTrusteeCaseAppointments.createDeps(context),
        events,
      );

      expect(professionalIdsRepo.findByAcmsProfessionalId).toHaveBeenCalledWith('081-00123');
      expect(trusteeMatchHelpers.matchTrusteeByName).not.toHaveBeenCalled();
      expect(mockTrusteeCaseAppointmentsRepo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ caseId: 'case-001', trusteeId: 'trustee-999' }),
      );
    });

    test('falls back to name matching when the professional-ID lookup has no match', async () => {
      const professionalIdsRepo = factory.getTrusteeProfessionalIdsRepository(context);
      (professionalIdsRepo.findByAcmsProfessionalId as ReturnType<typeof vi.fn>).mockResolvedValue(
        [],
      );

      const events: TrusteeAppointmentSyncEvent[] = [
        { ...makeEvent('case-001', 'John Doe'), acmsProfessionalId: '081-00123' },
      ];

      await SyncTrusteeCaseAppointments.processAppointments(
        SyncTrusteeCaseAppointments.createDeps(context),
        events,
      );

      expect(professionalIdsRepo.findByAcmsProfessionalId).toHaveBeenCalledWith('081-00123');
      expect(trusteeMatchHelpers.matchTrusteeByName).toHaveBeenCalledWith(context, 'John Doe');
      expect(mockTrusteeCaseAppointmentsRepo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ caseId: 'case-001', trusteeId: 'trustee-123' }),
      );
    });

    test('falls back to name matching when the professional-ID lookup is ambiguous (multiple matches)', async () => {
      const professionalIdsRepo = factory.getTrusteeProfessionalIdsRepository(context);
      (professionalIdsRepo.findByAcmsProfessionalId as ReturnType<typeof vi.fn>).mockResolvedValue([
        { camsTrusteeId: 'trustee-999', acmsProfessionalId: '081-00123' },
        { camsTrusteeId: 'trustee-888', acmsProfessionalId: '081-00123' },
      ]);

      const events: TrusteeAppointmentSyncEvent[] = [
        { ...makeEvent('case-001', 'John Doe'), acmsProfessionalId: '081-00123' },
      ];

      await SyncTrusteeCaseAppointments.processAppointments(
        SyncTrusteeCaseAppointments.createDeps(context),
        events,
      );

      expect(trusteeMatchHelpers.matchTrusteeByName).toHaveBeenCalledWith(context, 'John Doe');
      expect(mockTrusteeCaseAppointmentsRepo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ caseId: 'case-001', trusteeId: 'trustee-123' }),
      );
    });

    test('skips the professional-ID lookup entirely when the event has no acmsProfessionalId', async () => {
      const professionalIdsRepo = factory.getTrusteeProfessionalIdsRepository(context);

      const events = [makeEvent('case-001', 'John Doe')];

      await SyncTrusteeCaseAppointments.processAppointments(
        SyncTrusteeCaseAppointments.createDeps(context),
        events,
      );

      expect(professionalIdsRepo.findByAcmsProfessionalId).not.toHaveBeenCalled();
      expect(trusteeMatchHelpers.matchTrusteeByName).toHaveBeenCalledWith(context, 'John Doe');
    });

    describe('reserved acmsProfessionalId values', () => {
      test.each(['XX-00000', 'XX-98000', 'XX-99999'])(
        'skips matching and verification entirely for reserved acmsProfessionalId %s, counting it as success',
        async (reservedId) => {
          const professionalIdsRepo = factory.getTrusteeProfessionalIdsRepository(context);

          const events: TrusteeAppointmentSyncEvent[] = [
            { ...makeEvent('case-001', 'John Doe'), acmsProfessionalId: reservedId },
          ];

          const { successCount, dlqMessages, notYetSyncedEvents, scenarioDistribution } =
            await SyncTrusteeCaseAppointments.processAppointments(
              SyncTrusteeCaseAppointments.createDeps(context),
              events,
            );

          expect(professionalIdsRepo.findByAcmsProfessionalId).not.toHaveBeenCalled();
          expect(trusteeMatchHelpers.matchTrusteeByName).not.toHaveBeenCalled();
          expect(mockVerificationRepo.getVerification).not.toHaveBeenCalled();
          expect(mockVerificationRepo.upsertVerification).not.toHaveBeenCalled();
          expect(mockCasesRepo.getCaseOrMovedCase).not.toHaveBeenCalled();
          expect(mockTrusteeCaseAppointmentsRepo.upsert).not.toHaveBeenCalled();

          expect(successCount).toBe(1);
          expect(dlqMessages).toHaveLength(0);
          expect(notYetSyncedEvents).toHaveLength(0);
          expect(scenarioDistribution.reservedIdSkippedCount).toBe(1);
        },
      );

      test('continues normal matching for a real (non-reserved) acmsProfessionalId', async () => {
        const professionalIdsRepo = factory.getTrusteeProfessionalIdsRepository(context);
        (
          professionalIdsRepo.findByAcmsProfessionalId as ReturnType<typeof vi.fn>
        ).mockResolvedValue([{ camsTrusteeId: 'trustee-999', acmsProfessionalId: '081-00123' }]);

        const events: TrusteeAppointmentSyncEvent[] = [
          { ...makeEvent('case-001', 'John Doe'), acmsProfessionalId: '081-00123' },
        ];

        const { successCount, scenarioDistribution } =
          await SyncTrusteeCaseAppointments.processAppointments(
            SyncTrusteeCaseAppointments.createDeps(context),
            events,
          );

        expect(professionalIdsRepo.findByAcmsProfessionalId).toHaveBeenCalledWith('081-00123');
        expect(mockTrusteeCaseAppointmentsRepo.upsert).toHaveBeenCalledWith(
          expect.objectContaining({ caseId: 'case-001', trusteeId: 'trustee-999' }),
        );
        expect(successCount).toBe(1);
        expect(scenarioDistribution.reservedIdSkippedCount).toBe(0);
      });

      test('falls through to name matching when acmsProfessionalId is undefined', async () => {
        const events = [makeEvent('case-001', 'John Doe')];

        const { scenarioDistribution } = await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          events,
        );

        expect(trusteeMatchHelpers.matchTrusteeByName).toHaveBeenCalledWith(context, 'John Doe');
        expect(scenarioDistribution.reservedIdSkippedCount).toBe(0);
      });
    });

    describe('empty demographics', () => {
      test('skips matching and verification entirely when fullName and all legacy/contact fields are blank', async () => {
        const events: TrusteeAppointmentSyncEvent[] = [
          {
            ...makeEvent('case-001', ''),
            dxtrTrustee: { fullName: '' },
          },
        ];

        const { successCount, dlqMessages, notYetSyncedEvents, scenarioDistribution } =
          await SyncTrusteeCaseAppointments.processAppointments(
            SyncTrusteeCaseAppointments.createDeps(context),
            events,
          );

        expect(trusteeMatchHelpers.matchTrusteeByName).not.toHaveBeenCalled();
        expect(mockVerificationRepo.getVerification).not.toHaveBeenCalled();
        expect(mockVerificationRepo.upsertVerification).not.toHaveBeenCalled();
        expect(mockCasesRepo.getCaseOrMovedCase).not.toHaveBeenCalled();
        expect(mockTrusteeCaseAppointmentsRepo.upsert).not.toHaveBeenCalled();

        expect(successCount).toBe(0);
        expect(dlqMessages).toHaveLength(0);
        expect(notYetSyncedEvents).toHaveLength(0);
        expect(scenarioDistribution.emptyDemographicsSkippedCount).toBe(1);
      });

      test('treats a whitespace-only fullName the same as blank', async () => {
        const events: TrusteeAppointmentSyncEvent[] = [
          {
            ...makeEvent('case-001', ''),
            dxtrTrustee: { fullName: '   ' },
          },
        ];

        const { scenarioDistribution } = await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          events,
        );

        expect(trusteeMatchHelpers.matchTrusteeByName).not.toHaveBeenCalled();
        expect(scenarioDistribution.emptyDemographicsSkippedCount).toBe(1);
      });

      test('still proceeds to matching when fullName is blank but legacy contact fields are present', async () => {
        const events: TrusteeAppointmentSyncEvent[] = [
          {
            ...makeEvent('case-001', ''),
            dxtrTrustee: { fullName: '', legacy: { address1: '123 Main St' } },
          },
        ];

        const { scenarioDistribution } = await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          events,
        );

        expect(trusteeMatchHelpers.matchTrusteeByName).toHaveBeenCalledWith(context, '');
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

    describe('fingerprint hit/miss counters', () => {
      test('counts a TRUSTEE_VARIATION bucket hit as fingerprintHitCount', async () => {
        const event = makeEvent('case-001', 'John Doe');
        const variant = buildVariant(event.dxtrTrustee);
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

      test('does not increment either fingerprint counter for reserved-id-skipped events', async () => {
        const events: TrusteeAppointmentSyncEvent[] = [
          { ...makeEvent('case-001', 'John Doe'), acmsProfessionalId: 'XX-99999' },
        ];

        const { scenarioDistribution } = await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          events,
        );

        expect(scenarioDistribution.fingerprintHitCount).toBe(0);
        expect(scenarioDistribution.fingerprintMissCount).toBe(0);
      });

      test('tallies fingerprintHitCount/fingerprintMissCount correctly across a mixed batch', async () => {
        const hitEvent = makeEvent('case-001', 'Known Trustee');
        const missEvent = makeEvent('case-002', 'Unknown Trustee');
        const skippedEvent: TrusteeAppointmentSyncEvent = {
          ...makeEvent('case-003', 'Reserved'),
          acmsProfessionalId: 'XX-00000',
        };
        const hitVariant = buildVariant(hitEvent.dxtrTrustee);
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
          [hitEvent, missEvent, skippedEvent],
        );

        expect(scenarioDistribution.fingerprintHitCount).toBe(1);
        expect(scenarioDistribution.fingerprintMissCount).toBe(1);
        expect(scenarioDistribution.reservedIdSkippedCount).toBe(1);
      });
    });

    test('should skip when existing appointment has the same trusteeId', async () => {
      const existingAppointment: CaseAppointment = {
        id: 'ca-1',
        caseId: 'case-001',
        trusteeId: 'trustee-123',
        assignedOn: '2024-01-01T00:00:00Z',
        createdOn: '2024-01-01T00:00:00Z',
        createdBy: { id: 'system', name: 'System' },
        updatedOn: '2024-01-01T00:00:00Z',
        updatedBy: { id: 'system', name: 'System' },
      };
      (
        mockTrusteeCaseAppointmentsRepo.getActiveByCaseId as ReturnType<typeof vi.fn>
      ).mockResolvedValue(existingAppointment);

      const events = [makeEvent('case-001', 'John Doe')];

      await SyncTrusteeCaseAppointments.processAppointments(
        SyncTrusteeCaseAppointments.createDeps(context),
        events,
      );

      expect(mockTrusteeCaseAppointmentsRepo.updateCaseAppointment).not.toHaveBeenCalled();
      expect(mockTrusteeCaseAppointmentsRepo.upsert).not.toHaveBeenCalled();
    });

    test('should soft-close old and create new when trustee changes', async () => {
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

      const events = [makeEvent('case-001', 'John Doe')];

      await SyncTrusteeCaseAppointments.processAppointments(
        SyncTrusteeCaseAppointments.createDeps(context),
        events,
      );

      // Should soft-close old appointment
      expect(mockTrusteeCaseAppointmentsRepo.updateCaseAppointment).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'ca-old',
          trusteeId: 'old-trustee',
          unassignedOn: expect.any(String),
        }),
      );

      // Should create new appointment
      expect(mockTrusteeCaseAppointmentsRepo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          caseId: 'case-001',
          trusteeId: 'trustee-123',
          assignedOn: expect.any(String),
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
      (trusteeMatchHelpers.matchTrusteeByName as ReturnType<typeof vi.fn>)
        .mockRejectedValueOnce(new Error('Match failed'))
        .mockResolvedValueOnce({ kind: 'resolved', trusteeId: 'trustee-456' });

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

    test('should persist NO_TRUSTEE_MATCH to verification collection, not DLQ', async () => {
      (trusteeMatchHelpers.matchTrusteeByName as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        kind: 'no-match',
      });

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

    test('should persist AMBIGUOUS_MATCH_RESOLVED to verification collection, not DLQ', async () => {
      (trusteeMatchHelpers.matchTrusteeByName as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        makeAmbiguousNameMatch(),
      );

      const scoredCandidates = [
        {
          trusteeId: 't-1',
          trusteeName: 'Trustee 1',
          totalScore: 90,
          addressScore: 100,
          nameScore: 100,
          phoneScore: null,
          emailScore: null,
          districtDivisionScore: 100,
          chapterScore: 100,
        },
        {
          trusteeId: 't-2',
          trusteeName: 'Trustee 2',
          totalScore: 40,
          addressScore: 0,
          nameScore: 0,
          phoneScore: null,
          emailScore: null,
          districtDivisionScore: 50,
          chapterScore: 0,
        },
      ];
      // Mock fuzzy matching to succeed with a winner
      vi.spyOn(trusteeMatchHelpers, 'resolveNameCollisionByScoring').mockResolvedValueOnce({
        kind: 'resolved',
        trusteeId: 't-1',
        candidateScores: scoredCandidates,
      });

      const { successCount, dlqMessages, scenarioDistribution } =
        await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          [makeEvent('case-001', 'Common Name')],
        );

      expect(trusteeMatchHelpers.resolveNameCollisionByScoring).toHaveBeenCalledWith(
        context,
        makeEvent('case-001', 'Common Name'),
        ['t-1', 't-2'],
      );
      // Fuzzy winner should NOT be auto-linked — saved to verification collection, but a
      // surrogate appointment IS written so the case reflects a pending mismatch
      expect(mockTrusteeCaseAppointmentsRepo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          caseId: 'case-001',
          isSurrogate: true,
        }),
      );
      expect(successCount).toBe(0);
      expect(dlqMessages).toHaveLength(0);
      expect(mockVerificationRepo.upsertVerification).toHaveBeenCalled();
      expect(scenarioDistribution.highConfidenceMatchCount).toBe(1);
    });

    test('should persist AMBIGUOUS_MATCH_UNRESOLVED to verification collection when fuzzy matching fails, not DLQ', async () => {
      (trusteeMatchHelpers.matchTrusteeByName as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        makeAmbiguousNameMatch(),
      );

      // Mock fuzzy matching to fail with scores
      const scoredCandidates = [
        {
          trusteeId: 't-1',
          trusteeName: 'John Doe 1',
          totalScore: 60,
          addressScore: 100,
          nameScore: 0,
          phoneScore: null,
          emailScore: null,
          districtDivisionScore: 50,
          chapterScore: 0,
        },
        {
          trusteeId: 't-2',
          trusteeName: 'John Doe 2',
          totalScore: 58,
          addressScore: 100,
          nameScore: 0,
          phoneScore: null,
          emailScore: null,
          districtDivisionScore: 45,
          chapterScore: 0,
        },
      ];
      vi.spyOn(trusteeMatchHelpers, 'resolveNameCollisionByScoring').mockResolvedValueOnce({
        kind: 'unresolved',
        candidateScores: scoredCandidates,
      });

      const { dlqMessages, successCount, scenarioDistribution } =
        await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          [makeEvent('case-001', 'Common Name')],
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
      expect(scenarioDistribution.multipleMatchCount).toBe(1);
    });

    test('should classify as CandidateLoadFailed, not NoTrusteeMatch, when scoring cannot load any candidate data', async () => {
      // matchTrusteeByName found a genuine name collision (more than one raw candidate) — this
      // is NOT "no trustee matched this name." Scoring simply couldn't load any candidate's
      // record (e.g. every candidate rejected with a non-transient error), which
      // resolveNameCollisionByScoring reports as { kind: 'no-match' }. Misclassifying this as
      // NoTrusteeMatch would misreport why the case needs review; misclassifying it as
      // AmbiguousMatchUnresolved would make the Data Verification UI's "Multiple Match" label
      // appear next to zero displayed candidates.
      (trusteeMatchHelpers.matchTrusteeByName as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        makeAmbiguousNameMatch(),
      );
      vi.spyOn(trusteeMatchHelpers, 'resolveNameCollisionByScoring').mockResolvedValueOnce({
        kind: 'no-match',
      });

      const { dlqMessages, successCount, scenarioDistribution } =
        await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          [makeEvent('case-001', 'Common Name')],
        );

      expect(dlqMessages).toHaveLength(0);
      expect(mockVerificationRepo.upsertVerification).toHaveBeenCalledWith(
        expect.objectContaining({
          mismatchReason: 'CANDIDATE_LOAD_FAILED',
          matchCandidates: [],
        }),
      );
      expect(mockTrusteeCaseAppointmentsRepo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          caseId: 'case-001',
          isSurrogate: true,
        }),
      );
      expect(successCount).toBe(0);
      expect(scenarioDistribution.candidateLoadFailedCount).toBe(1);
      expect(scenarioDistribution.noMatchCount).toBe(0);
      expect(scenarioDistribution.multipleMatchCount).toBe(0);
    });

    test.each([
      ['TooManyRequestsError', new TooManyRequestsError('TEST', { message: 'Throttled.' })],
      ['GatewayTimeoutError', new GatewayTimeoutError('TEST', { message: 'Timed out.' })],
    ])(
      'should route to retryableEvents (not AmbiguousMatchUnresolved or NoTrusteeMatch) when fuzzy matching fails transiently (%s)',
      async (_label, transientError) => {
        (trusteeMatchHelpers.matchTrusteeByName as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
          makeAmbiguousNameMatch(),
        );
        // Drives execution through processAppointments' single outer catch (originalError) block
        // in sync-trustee-case-appointments.ts, not just resolveNameCollisionByScoring in
        // isolation — this is the only way to exercise the control-flow bug described in
        // cams-o5gh: a rethrow from the helper alone would not prove the outer file routes it
        // correctly. Post-Move-B, resolveNameCollisionByScoring is called sequentially in the same
        // try block as matchTrusteeByName (no nested try/catch), so a rethrow here surfaces at the
        // same single catch site that handles every other transient error in the loop — this test
        // is the regression guard confirming that consolidation didn't reintroduce the original
        // cams-o5gh misclassification (a transient error swallowed as a permanent ambiguous-match
        // outcome).
        vi.spyOn(trusteeMatchHelpers, 'resolveNameCollisionByScoring').mockRejectedValueOnce(
          transientError,
        );

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

    test('should persist IMPERFECT_MATCH to verification collection, not DLQ', async () => {
      vi.spyOn(trusteeMatchHelpers, 'isAppointmentMatch').mockReturnValue(false);
      vi.spyOn(trusteeMatchHelpers, 'calculateCandidateScore').mockReturnValue({
        trusteeId: 'trustee-123',
        trusteeName: 'John Doe',
        totalScore: 60,
        addressScore: 100,
        nameScore: 0,
        phoneScore: null,
        emailScore: null,
        districtDivisionScore: 50,
        chapterScore: 0,
      });

      const events = [makeEvent('case-001', 'John Doe')];

      const { successCount, dlqMessages, scenarioDistribution } =
        await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          events,
        );

      expect(mockTrusteeCaseAppointmentsRepo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          caseId: 'case-001',
          isSurrogate: true,
        }),
      );
      expect(successCount).toBe(0);
      expect(dlqMessages).toHaveLength(0);
      expect(mockVerificationRepo.upsertVerification).toHaveBeenCalled();
      expect(scenarioDistribution.imperfectMatchCount).toBe(1);
    });

    test('should route a single non-perfect-match candidate to verification even at a very high score, since districtDivisionScore/chapterScore may come from different appointment records', async () => {
      // districtDivisionScore/chapterScore are each computed independently across all of a
      // trustee's appointments (see calculateDistrictDivisionScore/calculateChapterScore),
      // so a perfect-looking totalScore here does not guarantee a single appointment record
      // actually covers this case's court+division+chapter combination — isAppointmentMatch above
      // (mocked false) is the only check that verifies that. There is no score-based auto-match
      // path for a single non-perfect candidate; every one of them is a human-reviewed
      // ImperfectMatch regardless of how high totalScore is.
      vi.spyOn(trusteeMatchHelpers, 'isAppointmentMatch').mockReturnValue(false);
      vi.spyOn(trusteeMatchHelpers, 'calculateCandidateScore').mockReturnValue({
        trusteeId: 'trustee-123',
        trusteeName: 'John Doe',
        totalScore: 100,
        addressScore: 100,
        nameScore: 100,
        phoneScore: 100,
        emailScore: 0,
        districtDivisionScore: 100,
        chapterScore: 100,
      });

      const events = [makeEvent('case-001', 'John Doe')];

      const { successCount, dlqMessages, scenarioDistribution } =
        await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          events,
        );

      expect(successCount).toBe(0);
      expect(dlqMessages).toHaveLength(0);
      expect(mockVerificationRepo.upsertVerification).toHaveBeenCalled();
      expect(scenarioDistribution.imperfectMatchCount).toBe(1);
    });

    test('should fall back to raw error shape when error has data but unknown mismatchReason', async () => {
      const unknownError = new CamsError('SOME-MODULE', {
        message: 'Unknown data error',
        data: { mismatchReason: 'SOME_UNKNOWN_CODE', extra: 'value' },
      });
      (trusteeMatchHelpers.matchTrusteeByName as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        unknownError,
      );

      const { dlqMessages } = await SyncTrusteeCaseAppointments.processAppointments(
        SyncTrusteeCaseAppointments.createDeps(context),
        [makeEvent('case-001', 'John Doe')],
      );

      expect(dlqMessages).toHaveLength(1);
      expect((dlqMessages[0] as TrusteeAppointmentSyncEvent).error).toBeDefined();
      expect('mismatchReason' in dlqMessages[0]).toBe(false);
    });

    test('scenarioDistribution counts sum to total events processed for mixed batch', async () => {
      // Event 1: perfect match
      (trusteeMatchHelpers.matchTrusteeByName as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ kind: 'resolved', trusteeId: 'trustee-1' })
        // Event 2: NO_TRUSTEE_MATCH
        .mockResolvedValueOnce({ kind: 'no-match' })
        // Event 3: imperfect match
        .mockResolvedValueOnce({ kind: 'resolved', trusteeId: 'trustee-3' });

      vi.spyOn(trusteeMatchHelpers, 'isAppointmentMatch')
        .mockReturnValueOnce(true) // Event 1
        .mockReturnValueOnce(false); // Event 3

      vi.spyOn(trusteeMatchHelpers, 'calculateCandidateScore').mockReturnValue({
        trusteeId: 'trustee-3',
        trusteeName: 'Trustee 3',
        totalScore: 50,
        addressScore: 0,
        nameScore: 0,
        phoneScore: null,
        emailScore: null,
        districtDivisionScore: 50,
        chapterScore: 0,
      });

      const events = [
        makeEvent('case-001', 'Perfect'),
        makeEvent('case-002', 'NoMatch'),
        makeEvent('case-003', 'Imperfect'),
      ];

      const { scenarioDistribution } = await SyncTrusteeCaseAppointments.processAppointments(
        SyncTrusteeCaseAppointments.createDeps(context),
        events,
      );

      const sum =
        scenarioDistribution.autoMatchCount +
        scenarioDistribution.imperfectMatchCount +
        scenarioDistribution.highConfidenceMatchCount +
        scenarioDistribution.noMatchCount +
        scenarioDistribution.multipleMatchCount;

      expect(sum).toBe(events.length);
      expect(scenarioDistribution.autoMatchCount).toBe(1);
      expect(scenarioDistribution.noMatchCount).toBe(1);
      expect(scenarioDistribution.imperfectMatchCount).toBe(1);
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
          dxtrTrusteeName: 'John Doe',
          matchOutcome: 'auto-matched',
          matchedTrusteeId: 'trustee-123',
          appointmentStatus: 'active',
        }),
      );
    });

    test('should emit TRUSTEE_MATCH_AUDIT log for IMPERFECT_MATCH event', async () => {
      vi.spyOn(trusteeMatchHelpers, 'isAppointmentMatch').mockReturnValue(false);
      vi.spyOn(trusteeMatchHelpers, 'calculateCandidateScore').mockReturnValue({
        trusteeId: 'trustee-123',
        trusteeName: 'John Doe',
        totalScore: 60,
        addressScore: 100,
        nameScore: 0,
        phoneScore: null,
        emailScore: null,
        districtDivisionScore: 50,
        chapterScore: 0,
      });
      const infoSpy = vi.spyOn(context.logger, 'info');

      await SyncTrusteeCaseAppointments.processAppointments(
        SyncTrusteeCaseAppointments.createDeps(context),
        [makeEvent('case-001', 'John Doe')],
      );

      const auditCalls = infoSpy.mock.calls.filter((call) => call[1] === 'TRUSTEE_MATCH_AUDIT');
      expect(auditCalls).toHaveLength(1);
      expect(auditCalls[0][2]).toEqual(
        expect.objectContaining({
          matchOutcome: 'imperfect-match',
          matchedTrusteeId: 'trustee-123',
          scoringBreakdown: { districtDivisionScore: 50, chapterScore: 0 },
        }),
      );
    });

    test('should emit TRUSTEE_MATCH_AUDIT log for AMBIGUOUS_MATCH_RESOLVED event', async () => {
      (trusteeMatchHelpers.matchTrusteeByName as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        makeAmbiguousNameMatch(),
      );
      vi.spyOn(trusteeMatchHelpers, 'resolveNameCollisionByScoring').mockResolvedValueOnce({
        kind: 'resolved',
        trusteeId: 't-1',
        candidateScores: [
          {
            trusteeId: 't-1',
            trusteeName: 'T1',
            totalScore: 90,
            addressScore: 100,
            nameScore: 100,
            phoneScore: null,
            emailScore: null,
            districtDivisionScore: 100,
            chapterScore: 100,
          },
          {
            trusteeId: 't-2',
            trusteeName: 'T2',
            totalScore: 40,
            addressScore: 0,
            nameScore: 0,
            phoneScore: null,
            emailScore: null,
            districtDivisionScore: 50,
            chapterScore: 0,
          },
        ],
      });
      const infoSpy = vi.spyOn(context.logger, 'info');

      await SyncTrusteeCaseAppointments.processAppointments(
        SyncTrusteeCaseAppointments.createDeps(context),
        [makeEvent('case-001', 'Common Name')],
      );

      const auditCalls = infoSpy.mock.calls.filter((call) => call[1] === 'TRUSTEE_MATCH_AUDIT');
      expect(auditCalls).toHaveLength(1);
      expect(auditCalls[0][2]).toEqual(
        expect.objectContaining({
          matchOutcome: 'ambiguous-match-resolved',
          matchedTrusteeId: 't-1',
          scoringBreakdown: { districtDivisionScore: 100, chapterScore: 100 },
        }),
      );
    });

    test('should emit TRUSTEE_MATCH_AUDIT log for NO_TRUSTEE_MATCH event', async () => {
      (trusteeMatchHelpers.matchTrusteeByName as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        kind: 'no-match',
      });
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

    describe('TrusteeMatchVerification persistence', () => {
      test('upserts verification doc for IMPERFECT_MATCH outcome', async () => {
        vi.spyOn(trusteeMatchHelpers, 'isAppointmentMatch').mockReturnValue(false);
        vi.spyOn(trusteeMatchHelpers, 'calculateCandidateScore').mockReturnValue({
          trusteeId: 'trustee-123',
          trusteeName: 'John Doe',
          totalScore: 60,
          addressScore: 100,
          nameScore: 0,
          phoneScore: null,
          emailScore: null,
          districtDivisionScore: 50,
          chapterScore: 0,
        });

        await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          [makeEvent('case-001', 'John Doe')],
        );

        expect(mockVerificationRepo.upsertVerification).toHaveBeenCalledWith(
          expect.objectContaining({
            documentType: 'TRUSTEE_MATCH_VERIFICATION',
            caseId: 'case-001',
            courtId: '081',
            mismatchReason: 'IMPERFECT_MATCH',
            status: 'pending',
          }),
        );
      });

      test('carries acmsProfessionalId and appointedDate from the event onto a new verification doc', async () => {
        vi.spyOn(trusteeMatchHelpers, 'isAppointmentMatch').mockReturnValue(false);
        vi.spyOn(trusteeMatchHelpers, 'calculateCandidateScore').mockReturnValue({
          trusteeId: 'trustee-123',
          trusteeName: 'John Doe',
          totalScore: 60,
          addressScore: 100,
          nameScore: 0,
          phoneScore: null,
          emailScore: null,
          districtDivisionScore: 50,
          chapterScore: 0,
        });

        await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          [
            {
              ...makeEvent('case-001', 'John Doe'),
              acmsProfessionalId: '081-00123',
              appointedDate: '2025-06-01',
            },
          ],
        );

        expect(mockVerificationRepo.upsertVerification).toHaveBeenCalledWith(
          expect.objectContaining({
            caseId: 'case-001',
            acmsProfessionalId: '081-00123',
            appointedDate: '2025-06-01',
          }),
        );
      });

      test('upserts verification doc for AMBIGUOUS_MATCH_RESOLVED outcome', async () => {
        (trusteeMatchHelpers.matchTrusteeByName as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
          makeAmbiguousNameMatch(),
        );
        const scoredCandidates = [
          {
            trusteeId: 't-1',
            trusteeName: 'T1',
            totalScore: 90,
            addressScore: 100,
            nameScore: 100,
            phoneScore: null,
            emailScore: null,
            districtDivisionScore: 100,
            chapterScore: 100,
          },
          {
            trusteeId: 't-2',
            trusteeName: 'T2',
            totalScore: 40,
            addressScore: 0,
            nameScore: 0,
            phoneScore: null,
            emailScore: null,
            districtDivisionScore: 50,
            chapterScore: 0,
          },
        ];
        vi.spyOn(trusteeMatchHelpers, 'resolveNameCollisionByScoring').mockResolvedValueOnce({
          kind: 'resolved',
          trusteeId: 't-1',
          candidateScores: scoredCandidates,
        });

        await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          [makeEvent('case-001', 'Common Name')],
        );

        expect(mockVerificationRepo.upsertVerification).toHaveBeenCalledWith(
          expect.objectContaining({
            documentType: 'TRUSTEE_MATCH_VERIFICATION',
            caseId: 'case-001',
            mismatchReason: 'AMBIGUOUS_MATCH_RESOLVED',
            matchCandidates: scoredCandidates,
            status: 'pending',
          }),
        );
      });

      test('upserts verification doc for AMBIGUOUS_MATCH_UNRESOLVED outcome', async () => {
        (trusteeMatchHelpers.matchTrusteeByName as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
          makeAmbiguousNameMatch(),
        );
        vi.spyOn(trusteeMatchHelpers, 'resolveNameCollisionByScoring').mockResolvedValueOnce({
          kind: 'unresolved',
          candidateScores: [],
        });

        await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          [makeEvent('case-001', 'Common Name')],
        );

        expect(mockVerificationRepo.upsertVerification).toHaveBeenCalledWith(
          expect.objectContaining({
            documentType: 'TRUSTEE_MATCH_VERIFICATION',
            caseId: 'case-001',
            mismatchReason: 'AMBIGUOUS_MATCH_UNRESOLVED',
            status: 'pending',
          }),
        );
      });

      test('upserts verification doc for NO_TRUSTEE_MATCH outcome', async () => {
        (trusteeMatchHelpers.matchTrusteeByName as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          kind: 'no-match',
        });

        await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          [makeEvent('case-001', 'Ghost Trustee')],
        );

        expect(mockVerificationRepo.upsertVerification).toHaveBeenCalledWith(
          expect.objectContaining({
            documentType: 'TRUSTEE_MATCH_VERIFICATION',
            caseId: 'case-001',
            mismatchReason: 'NO_TRUSTEE_MATCH',
            matchCandidates: [],
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
            mismatchReason: 'NO_TRUSTEE_MATCH',
            matchCandidates: [],
            variant: buildVariant(event.dxtrTrustee),
            fingerprint: computeFingerprint(buildVariant(event.dxtrTrustee)),
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

        expect(trusteeMatchHelpers.matchTrusteeByName).not.toHaveBeenCalled();
        expect(mockVerificationRepo.upsertVerification).not.toHaveBeenCalled();
        expect(mockTrusteeCaseAppointmentsRepo.upsert).toHaveBeenCalledWith(
          expect.objectContaining({ caseId: 'case-001', isSurrogate: true }),
        );
        expect(scenarioDistribution.verificationBucketHitCount).toBe(1);
        expect(successCount).toBe(0);
      });

      test('routes to DLQ instead of writing a surrogate appointment with a malformed chapter', async () => {
        const event = makeEvent('case-001', 'John Doe');
        (mockCasesRepo.getCaseOrMovedCase as ReturnType<typeof vi.fn>).mockResolvedValue({
          caseId: 'case-001',
          trusteeId: undefined,
          courtId: '081',
          courtDivisionCode: '081',
          chapter: '7A', // DXTR sub-code, not a valid CaseChapter
          dateFiled: '2026-01-07',
        });
        (mockVerificationRepo.findByFingerprint as ReturnType<typeof vi.fn>).mockResolvedValue([
          {
            id: 'existing-doc-id',
            documentType: 'TRUSTEE_MATCH_VERIFICATION',
            caseId: 'case-999',
            status: 'pending',
            mismatchReason: 'NO_TRUSTEE_MATCH',
            matchCandidates: [],
            variant: buildVariant(event.dxtrTrustee),
            fingerprint: computeFingerprint(buildVariant(event.dxtrTrustee)),
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
        expect(dlqMessages).toHaveLength(1);
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
            variant: buildVariant(event.dxtrTrustee),
            fingerprint: computeFingerprint(buildVariant(event.dxtrTrustee)),
          },
        ]);
        vi.spyOn(trusteeMatchHelpers, 'isAppointmentMatch').mockReturnValue(false);
        vi.spyOn(trusteeMatchHelpers, 'calculateCandidateScore').mockReturnValue({
          trusteeId: 'trustee-123',
          trusteeName: 'John Doe',
          totalScore: 60,
          addressScore: 100,
          nameScore: 0,
          phoneScore: null,
          emailScore: null,
          districtDivisionScore: 50,
          chapterScore: 0,
        });

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
            variant: buildVariant(event.dxtrTrustee),
            fingerprint: computeFingerprint(buildVariant(event.dxtrTrustee)),
          },
        ]);
        (trusteeMatchHelpers.matchTrusteeByName as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          kind: 'no-match',
        });

        await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          [event],
        );

        expect(mockVerificationRepo.upsertVerification).not.toHaveBeenCalled();
      });

      test('sets createdOn and omits updatedBy as SYSTEM for first-time insert', async () => {
        (trusteeMatchHelpers.matchTrusteeByName as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          kind: 'no-match',
        });

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
      // Enrichment mutates event.dxtrTrustee.legacy in place before matching runs, so these
      // assert directly on the event object rather than on a downstream repo call — auto-matched
      // outcomes (the default mock setup in this describe block) no longer write a verification
      // doc at all, so that's no longer an available observation point.
      test('populates dxtrTrustee.legacy.parsedCityStateZip when cityStateZipCountry is parseable', async () => {
        const event: TrusteeAppointmentSyncEvent = {
          ...makeEvent('case-001', 'John Doe'),
          dxtrTrustee: {
            fullName: 'John Doe',
            legacy: { cityStateZipCountry: 'New York, NY 10001' },
          },
        };

        await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          [event],
        );

        expect(event.dxtrTrustee.legacy?.parsedCityStateZip).toEqual({
          city: 'New York',
          state: 'NY',
          zipCode: '10001',
        });
      });

      test('sets dxtrTrustee.legacy.parsedCityStateZip to null when cityStateZipCountry is present but unparseable', async () => {
        const event: TrusteeAppointmentSyncEvent = {
          ...makeEvent('case-001', 'John Doe'),
          dxtrTrustee: {
            fullName: 'John Doe',
            legacy: { cityStateZipCountry: 'not a valid address' },
          },
        };

        await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          [event],
        );

        expect(event.dxtrTrustee.legacy?.parsedCityStateZip).toBeNull();
      });

      test('leaves dxtrTrustee.legacy.parsedCityStateZip absent when there is no cityStateZipCountry', async () => {
        const event: TrusteeAppointmentSyncEvent = {
          ...makeEvent('case-001', 'John Doe'),
          dxtrTrustee: {
            fullName: 'John Doe',
            legacy: { phone: '555-1234' },
          },
        };

        await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          [event],
        );

        expect(event.dxtrTrustee.legacy).not.toHaveProperty('parsedCityStateZip');
      });
    });

    describe('PERFECT_MATCH_INACTIVE_STATUS handling', () => {
      const inactiveAppointment: TrusteeAppointment = {
        id: 'appt-inactive',
        trusteeId: 'trustee-123',
        chapter: '7' as const,
        courtId: '081',
        divisionCode: 'NY',
        appointmentType: 'panel' as const,
        appointedDate: '2020-01-01T00:00:00Z',
        effectiveDate: '2020-01-01T00:00:00Z',
        status: 'voluntarily-suspended' as const,
        createdBy: { id: 'system', name: 'System' },
        createdOn: '2024-01-01T00:00:00Z',
        updatedBy: { id: 'system', name: 'System' },
        updatedOn: '2024-01-01T00:00:00Z',
      };

      beforeEach(() => {
        vi.spyOn(trusteeMatchHelpers, 'isAppointmentMatch').mockReturnValue(false);
        vi.spyOn(trusteeMatchHelpers, 'findInactivePerfectMatch').mockReturnValue(
          inactiveAppointment,
        );
        vi.spyOn(trusteeMatchHelpers, 'calculateAddressScore').mockReturnValue(100);
        (mockAppointmentsRepo.getTrusteeAppointments as ReturnType<typeof vi.fn>).mockResolvedValue(
          [inactiveAppointment],
        );
      });

      test('should persist PERFECT_MATCH_INACTIVE_STATUS to verification collection', async () => {
        const { successCount, dlqMessages, scenarioDistribution } =
          await SyncTrusteeCaseAppointments.processAppointments(
            SyncTrusteeCaseAppointments.createDeps(context),
            [makeEvent('case-001', 'John Doe')],
          );

        expect(mockTrusteeCaseAppointmentsRepo.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            caseId: 'case-001',
            isSurrogate: true,
          }),
        );
        expect(successCount).toBe(0);
        expect(dlqMessages).toHaveLength(0);
        expect(mockVerificationRepo.upsertVerification).toHaveBeenCalledWith(
          expect.objectContaining({
            documentType: 'TRUSTEE_MATCH_VERIFICATION',
            caseId: 'case-001',
            mismatchReason: 'PERFECT_MATCH_INACTIVE_STATUS',
            inactiveAppointmentStatus: 'voluntarily-suspended',
            status: 'pending',
            matchCandidates: [
              expect.objectContaining({
                trusteeId: 'trustee-123',
                // addressScore mocked to 100; dxtrTrustee/trustee fixtures here have no
                // firstName/lastName so calculateNameScore (real) yields 0.
                // phone/email null (fixture sets no phone/email) -> applicableWeight = 0.9
                // weightedSum = 100*0.05 + 0*0.25 + 100*0.3 + 100*0.3 = 5 + 0 + 30 + 30 = 65
                // 65 / 0.9 = 72.2222
                totalScore: expect.closeTo(72.2222, 4),
                nameScore: 0,
                phoneScore: null,
                emailScore: null,
                districtDivisionScore: 100,
                chapterScore: 100,
              }),
            ],
          }),
        );
        expect(scenarioDistribution.perfectMatchInactiveCount).toBe(1);
      });

      test('should emit TRUSTEE_MATCH_AUDIT log for inactive-perfect-match', async () => {
        const infoSpy = vi.spyOn(context.logger, 'info');

        await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          [makeEvent('case-001', 'John Doe')],
        );

        const auditCalls = infoSpy.mock.calls.filter((call) => call[1] === 'TRUSTEE_MATCH_AUDIT');
        expect(auditCalls).toHaveLength(1);
        expect(auditCalls[0][2]).toEqual(
          expect.objectContaining({
            matchOutcome: 'inactive-perfect-match',
            matchedTrusteeId: 'trustee-123',
            appointmentStatus: 'voluntarily-suspended',
            scoringBreakdown: { districtDivisionScore: 100, chapterScore: 100 },
          }),
        );
      });

      test('should populate phoneScore/emailScore and redistribute totalScore when phone/email match', async () => {
        (mockTrusteesRepo.read as ReturnType<typeof vi.fn>).mockResolvedValue({
          trusteeId: 'trustee-123',
          name: 'John Doe',
          public: {
            address: {},
            phone: { number: '662-286-9796' },
            email: 'john.doe@example.com',
          },
        });

        const event: TrusteeAppointmentSyncEvent = {
          ...makeEvent('case-001', 'John Doe'),
          dxtrTrustee: {
            fullName: 'John Doe',
            legacy: {
              phone: '6622869796',
              email: 'john.doe@example.com',
            },
          },
        };

        await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          [event],
        );

        expect(mockVerificationRepo.upsertVerification).toHaveBeenCalledWith(
          expect.objectContaining({
            matchCandidates: [
              expect.objectContaining({
                trusteeId: 'trustee-123',
                // addressScore mocked to 100; dxtrTrustee/trustee fixtures here have no
                // firstName/lastName so calculateNameScore (real) yields 0.
                // phone and email both match (real calculatePhoneScore/calculateEmailScore).
                // (100*0.05) + (0*0.25) + (100*0.05) + (100*0.05) + (100*0.3) + (100*0.3)
                // = 5 + 0 + 5 + 5 + 30 + 30 = 75
                totalScore: 75,
                nameScore: 0,
                phoneScore: 100,
                emailScore: 100,
                districtDivisionScore: 100,
                chapterScore: 100,
              }),
            ],
          }),
        );
      });

      test('should fall through to IMPERFECT_MATCH when findInactivePerfectMatch returns undefined', async () => {
        vi.spyOn(trusteeMatchHelpers, 'findInactivePerfectMatch').mockReturnValue(undefined);
        vi.spyOn(trusteeMatchHelpers, 'calculateCandidateScore').mockReturnValue({
          trusteeId: 'trustee-123',
          trusteeName: 'John Doe',
          totalScore: 60,
          addressScore: 100,
          nameScore: 0,
          phoneScore: null,
          emailScore: null,
          districtDivisionScore: 50,
          chapterScore: 0,
        });

        const { scenarioDistribution } = await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          [makeEvent('case-001', 'John Doe')],
        );

        expect(scenarioDistribution.imperfectMatchCount).toBe(1);
        expect(scenarioDistribution.perfectMatchInactiveCount).toBe(0);
      });

      test('should include perfectMatchInactiveCount in scenarioDistribution for mixed batch', async () => {
        // Event 1: perfect match (auto-link)
        (trusteeMatchHelpers.matchTrusteeByName as ReturnType<typeof vi.fn>)
          .mockResolvedValueOnce({ kind: 'resolved', trusteeId: 'trustee-1' })
          // Event 2: inactive perfect match
          .mockResolvedValueOnce({ kind: 'resolved', trusteeId: 'trustee-2' })
          // Event 3: no match
          .mockResolvedValueOnce({ kind: 'no-match' });

        vi.spyOn(trusteeMatchHelpers, 'isAppointmentMatch')
          .mockReturnValueOnce(true) // Event 1
          .mockReturnValueOnce(false); // Event 2

        // Event 1 takes the isAppointmentMatch=true branch, so findInactivePerfectMatch is not called.
        // Only Event 2 calls it.
        vi.spyOn(trusteeMatchHelpers, 'findInactivePerfectMatch').mockReturnValueOnce(
          inactiveAppointment,
        );

        const { scenarioDistribution } = await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          [
            makeEvent('case-001', 'Perfect'),
            makeEvent('case-002', 'Inactive'),
            makeEvent('case-003', 'NoMatch'),
          ],
        );

        expect(scenarioDistribution.autoMatchCount).toBe(1);
        expect(scenarioDistribution.perfectMatchInactiveCount).toBe(1);
        expect(scenarioDistribution.noMatchCount).toBe(1);
      });

      test('should track reVerificationCount when inactive match already resolved', async () => {
        const event = makeEvent('case-001', 'John Doe');
        (mockVerificationRepo.findByFingerprint as ReturnType<typeof vi.fn>).mockResolvedValue([
          {
            documentType: 'TRUSTEE_MATCH_VERIFICATION',
            caseId: 'case-001',
            status: 'approved',
            createdOn: '2025-01-01T00:00:00.000Z',
            updatedOn: '2025-01-01T00:00:00.000Z',
            updatedBy: { id: 'user-1', name: 'Operator' },
            variant: buildVariant(event.dxtrTrustee),
            fingerprint: computeFingerprint(buildVariant(event.dxtrTrustee)),
          },
        ]);

        const { scenarioDistribution } = await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          [event],
        );

        expect(mockVerificationRepo.upsertVerification).not.toHaveBeenCalled();
        expect(scenarioDistribution.reVerificationCount).toBe(1);
        expect(scenarioDistribution.perfectMatchInactiveCount).toBe(1);
      });
    });

    describe('surrogate CaseAppointment writes', () => {
      test('writes a surrogate appointment with trusteeId = fingerprint and the raw variant on a NO_TRUSTEE_MATCH outcome', async () => {
        const event = makeEvent('case-001', 'Ghost Trustee');
        (trusteeMatchHelpers.matchTrusteeByName as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          kind: 'no-match',
        });

        await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          [event],
        );

        const expectedVariant = buildVariant(event.dxtrTrustee);
        const expectedFingerprint = computeFingerprint(expectedVariant);
        expect(mockTrusteeCaseAppointmentsRepo.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            caseId: 'case-001',
            trusteeId: expectedFingerprint,
            isSurrogate: true,
            variant: expectedVariant,
            dateFiled: '2026-01-07',
            chapter: '7',
            courtDivisionCode: '081',
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
        (trusteeMatchHelpers.matchTrusteeByName as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          kind: 'no-match',
        });

        await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          [makeEvent('case-001', 'Ghost Trustee')],
        );

        expect(mockTrusteeCaseAppointmentsRepo.upsert).toHaveBeenCalledWith(
          expect.objectContaining({ caseId: 'case-001', isSurrogate: true }),
        );
      });

      test('does not write a duplicate surrogate appointment when the same unresolved event is reprocessed', async () => {
        const event = makeEvent('case-001', 'Ghost Trustee');
        (trusteeMatchHelpers.matchTrusteeByName as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          kind: 'no-match',
        });

        await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          [event],
        );
        expect(mockTrusteeCaseAppointmentsRepo.upsert).toHaveBeenCalledTimes(1);

        // Second sync run: the surrogate written above already exists for this fingerprint.
        const expectedVariant = buildVariant(event.dxtrTrustee);
        const expectedFingerprint = computeFingerprint(expectedVariant);
        (mockTrusteeCaseAppointmentsRepo.getByCaseId as ReturnType<typeof vi.fn>).mockResolvedValue(
          [
            {
              id: 'ca-surrogate',
              caseId: 'case-001',
              trusteeId: expectedFingerprint,
              isSurrogate: true,
              variant: expectedVariant,
              assignedOn: '2026-01-01T00:00:00Z',
              createdOn: '2026-01-01T00:00:00Z',
              createdBy: { id: 'system', name: 'System' },
              updatedOn: '2026-01-01T00:00:00Z',
              updatedBy: { id: 'system', name: 'System' },
            },
          ],
        );
        (trusteeMatchHelpers.matchTrusteeByName as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          kind: 'no-match',
        });

        await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          [event],
        );

        expect(mockTrusteeCaseAppointmentsRepo.upsert).toHaveBeenCalledTimes(1);
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
        (trusteeMatchHelpers.matchTrusteeByName as ReturnType<typeof vi.fn>).mockResolvedValue({
          kind: 'no-match',
        });

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
        (trusteeMatchHelpers.matchTrusteeByName as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          kind: 'no-match',
        });

        await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          [event],
        );

        const expectedFingerprint = computeFingerprint(buildVariant(event.dxtrTrustee));
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
      test('should populate matchCandidates with the scored candidate for an ImperfectMatch outcome', async () => {
        // ImperfectMatch is handled inline in the try block (see the score-threshold check in
        // processAppointments) rather than via a thrown/caught/classified error, so there is no
        // intermediary "missing matchCandidates" shape to default away — the real call site
        // always passes [candidateScore] directly to handleClassifiedMismatch.
        vi.spyOn(trusteeMatchHelpers, 'isAppointmentMatch').mockReturnValue(false);
        vi.spyOn(trusteeMatchHelpers, 'calculateCandidateScore').mockReturnValue({
          trusteeId: 'trustee-123',
          trusteeName: 'John Doe',
          totalScore: 60,
          addressScore: 100,
          nameScore: 0,
          phoneScore: null,
          emailScore: null,
          districtDivisionScore: 50,
          chapterScore: 0,
        });

        const { dlqMessages } = await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          [makeEvent('case-001', 'John Doe')],
        );

        expect(dlqMessages).toHaveLength(0);
        expect(mockVerificationRepo.upsertVerification).toHaveBeenCalledWith(
          expect.objectContaining({
            mismatchReason: 'IMPERFECT_MATCH',
            matchCandidates: [
              expect.objectContaining({ trusteeId: 'trustee-123', totalScore: 60 }),
            ],
          }),
        );
      });

      test('should track reVerificationCount when AMBIGUOUS_MATCH_RESOLVED already resolved', async () => {
        const matchCandidates = [
          {
            trusteeId: 't-1',
            trusteeName: 'T1',
            totalScore: -1,
            addressScore: -1,
            nameScore: -1,
            phoneScore: -1,
            emailScore: -1,
            districtDivisionScore: -1,
            chapterScore: -1,
          },
          {
            trusteeId: 't-2',
            trusteeName: 'T2',
            totalScore: -1,
            addressScore: -1,
            nameScore: -1,
            phoneScore: -1,
            emailScore: -1,
            districtDivisionScore: -1,
            chapterScore: -1,
          },
        ];
        (trusteeMatchHelpers.matchTrusteeByName as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          kind: 'ambiguous',
          matchCandidates,
        });
        vi.spyOn(trusteeMatchHelpers, 'resolveNameCollisionByScoring').mockResolvedValueOnce({
          kind: 'resolved',
          trusteeId: 't-1',
          candidateScores: [
            {
              trusteeId: 't-1',
              trusteeName: 'T1',
              totalScore: 90,
              addressScore: 100,
              nameScore: 100,
              phoneScore: null,
              emailScore: null,
              districtDivisionScore: 100,
              chapterScore: 100,
            },
          ],
        });
        const event = makeEvent('case-001', 'Common Name');
        (mockVerificationRepo.findByFingerprint as ReturnType<typeof vi.fn>).mockResolvedValue([
          {
            documentType: 'TRUSTEE_MATCH_VERIFICATION',
            caseId: 'case-001',
            status: 'approved',
            createdOn: '2025-01-01T00:00:00.000Z',
            updatedOn: '2025-01-01T00:00:00.000Z',
            updatedBy: { id: 'user-1', name: 'Operator' },
            variant: buildVariant(event.dxtrTrustee),
            fingerprint: computeFingerprint(buildVariant(event.dxtrTrustee)),
          },
        ]);

        const { scenarioDistribution } = await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          [event],
        );

        expect(scenarioDistribution.reVerificationCount).toBe(1);
        expect(scenarioDistribution.highConfidenceMatchCount).toBe(1);
      });

      test('should omit scoringBreakdown when fuzzy winner is not in candidateScores', async () => {
        const matchCandidates = [
          {
            trusteeId: 't-1',
            trusteeName: 'T1',
            totalScore: -1,
            addressScore: -1,
            nameScore: -1,
            phoneScore: -1,
            emailScore: -1,
            districtDivisionScore: -1,
            chapterScore: -1,
          },
          {
            trusteeId: 't-2',
            trusteeName: 'T2',
            totalScore: -1,
            addressScore: -1,
            nameScore: -1,
            phoneScore: -1,
            emailScore: -1,
            districtDivisionScore: -1,
            chapterScore: -1,
          },
        ];
        (trusteeMatchHelpers.matchTrusteeByName as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          kind: 'ambiguous',
          matchCandidates,
        });
        vi.spyOn(trusteeMatchHelpers, 'resolveNameCollisionByScoring').mockResolvedValueOnce({
          kind: 'resolved',
          trusteeId: 'unknown-winner', // not in candidateScores
          candidateScores: [
            {
              trusteeId: 't-1',
              trusteeName: 'T1',
              totalScore: 90,
              addressScore: 100,
              nameScore: 100,
              phoneScore: null,
              emailScore: null,
              districtDivisionScore: 100,
              chapterScore: 100,
            },
          ],
        });
        const infoSpy = vi.spyOn(context.logger, 'info');

        await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          [makeEvent('case-001', 'Common Name')],
        );

        const auditCalls = infoSpy.mock.calls.filter((call) => call[1] === 'TRUSTEE_MATCH_AUDIT');
        expect(auditCalls).toHaveLength(1);
        expect(auditCalls[0][2]).toEqual(
          expect.objectContaining({
            matchOutcome: 'ambiguous-match-resolved',
            matchedTrusteeId: 'unknown-winner',
            scoringBreakdown: null,
          }),
        );
      });

      test('should persist an empty matchCandidates array when the unresolved outcome carries none', async () => {
        // ScoringOutcome's 'unresolved' variant always carries a real candidateScores array (the
        // type guarantees this — there is no longer a "malformed error data" shape to default
        // away), but an empty array is still a legitimate value to verify flows through correctly.
        const matchCandidates = [
          {
            trusteeId: 't-1',
            trusteeName: 'T1',
            totalScore: -1,
            addressScore: -1,
            nameScore: -1,
            phoneScore: -1,
            emailScore: -1,
            districtDivisionScore: -1,
            chapterScore: -1,
          },
        ];
        (trusteeMatchHelpers.matchTrusteeByName as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          kind: 'ambiguous',
          matchCandidates,
        });
        vi.spyOn(trusteeMatchHelpers, 'resolveNameCollisionByScoring').mockResolvedValueOnce({
          kind: 'unresolved',
          candidateScores: [],
        });

        const { dlqMessages } = await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          [makeEvent('case-001', 'Common Name')],
        );

        expect(dlqMessages).toHaveLength(0);
        expect(mockVerificationRepo.upsertVerification).toHaveBeenCalledWith(
          expect.objectContaining({
            mismatchReason: 'AMBIGUOUS_MATCH_UNRESOLVED',
            matchCandidates: [],
          }),
        );
      });

      test('should track reVerificationCount when AMBIGUOUS_MATCH_UNRESOLVED already resolved', async () => {
        const matchCandidates = [
          {
            trusteeId: 't-1',
            trusteeName: 'T1',
            totalScore: -1,
            addressScore: -1,
            nameScore: -1,
            phoneScore: -1,
            emailScore: -1,
            districtDivisionScore: -1,
            chapterScore: -1,
          },
        ];
        (trusteeMatchHelpers.matchTrusteeByName as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          kind: 'ambiguous',
          matchCandidates,
        });
        vi.spyOn(trusteeMatchHelpers, 'resolveNameCollisionByScoring').mockResolvedValueOnce({
          kind: 'unresolved',
          candidateScores: [],
        });
        const event = makeEvent('case-001', 'Common Name');
        (mockVerificationRepo.findByFingerprint as ReturnType<typeof vi.fn>).mockResolvedValue([
          {
            documentType: 'TRUSTEE_MATCH_VERIFICATION',
            caseId: 'case-001',
            status: 'approved',
            createdOn: '2025-01-01T00:00:00.000Z',
            updatedOn: '2025-01-01T00:00:00.000Z',
            updatedBy: { id: 'user-1', name: 'Operator' },
            variant: buildVariant(event.dxtrTrustee),
            fingerprint: computeFingerprint(buildVariant(event.dxtrTrustee)),
          },
        ]);

        const { scenarioDistribution } = await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          [event],
        );

        expect(scenarioDistribution.reVerificationCount).toBe(1);
        expect(scenarioDistribution.multipleMatchCount).toBe(1);
      });

      test('should track reVerificationCount when IMPERFECT_MATCH already resolved', async () => {
        vi.spyOn(trusteeMatchHelpers, 'isAppointmentMatch').mockReturnValue(false);
        vi.spyOn(trusteeMatchHelpers, 'calculateCandidateScore').mockReturnValue({
          trusteeId: 'trustee-123',
          trusteeName: 'John Doe',
          totalScore: 60,
          addressScore: 100,
          nameScore: 0,
          phoneScore: null,
          emailScore: null,
          districtDivisionScore: 50,
          chapterScore: 0,
        });
        const event = makeEvent('case-001', 'John Doe');
        (mockVerificationRepo.findByFingerprint as ReturnType<typeof vi.fn>).mockResolvedValue([
          {
            documentType: 'TRUSTEE_MATCH_VERIFICATION',
            caseId: 'case-001',
            status: 'approved',
            createdOn: '2025-01-01T00:00:00.000Z',
            updatedOn: '2025-01-01T00:00:00.000Z',
            updatedBy: { id: 'user-1', name: 'Operator' },
            variant: buildVariant(event.dxtrTrustee),
            fingerprint: computeFingerprint(buildVariant(event.dxtrTrustee)),
          },
        ]);

        const { scenarioDistribution } = await SyncTrusteeCaseAppointments.processAppointments(
          SyncTrusteeCaseAppointments.createDeps(context),
          [event],
        );

        expect(scenarioDistribution.reVerificationCount).toBe(1);
        expect(scenarioDistribution.imperfectMatchCount).toBe(1);
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
          variant: buildVariant(event.dxtrTrustee),
          fingerprint: computeFingerprint(buildVariant(event.dxtrTrustee)),
        },
      ]);
      (trusteeMatchHelpers.matchTrusteeByName as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        kind: 'no-match',
      });

      const { scenarioDistribution } = await SyncTrusteeCaseAppointments.processAppointments(
        SyncTrusteeCaseAppointments.createDeps(context),
        [event],
      );

      expect(scenarioDistribution.reVerificationCount).toBe(1);
      expect(scenarioDistribution.noMatchCount).toBe(1);
    });
  });

  describe('getAppointmentEvents', () => {
    let context: ApplicationContext;
    let mockRuntimeStateRepo: Partial<RuntimeStateRepository<TrusteeAppointmentsSyncState>>;
    let mockPetitionSyncStateRepo: Partial<RuntimeStateRepository<TrusteePetitionSyncState>>;
    let mockCasesGateway: Partial<CasesInterface>;

    const mockEvents: TrusteeAppointmentSyncEvent[] = [
      { caseId: 'case-001', courtId: '081', dxtrTrustee: { fullName: 'Jane Doe' } },
    ];
    const mockLatestSyncDate = '2025-01-15T00:00:00Z';
    const mockPetitionEvents: TrusteeAppointmentSyncEvent[] = [];
    const mockPetitionLatestSyncDate = '2025-01-05T00:00:00Z';

    beforeEach(async () => {
      vi.restoreAllMocks();
      if (context) await closeDeferred(context);
      context = await createMockApplicationContext();

      mockRuntimeStateRepo = {
        read: vi.fn().mockResolvedValue({
          id: 'state-1',
          documentType: 'TRUSTEE_APPOINTMENTS_SYNC_STATE',
          lastSyncDate: '2025-01-01T00:00:00Z',
        }),
      };

      mockPetitionSyncStateRepo = {
        read: vi.fn().mockResolvedValue({
          id: 'petition-state-1',
          documentType: 'TRUSTEE_PETITION_SYNC_STATE',
          lastSyncDate: '2024-06-01T00:00:00Z',
        }),
      };

      mockCasesGateway = {
        getTrusteeAppointments: vi
          .fn()
          .mockResolvedValue({ events: mockEvents, latestSyncDate: mockLatestSyncDate }),
        getTrusteePetitionEvents: vi.fn().mockResolvedValue({
          events: mockPetitionEvents,
          latestSyncDate: mockPetitionLatestSyncDate,
        }),
      };

      vi.spyOn(factory, 'getTrusteeAppointmentsSyncStateRepo').mockReturnValue(
        mockRuntimeStateRepo as RuntimeStateRepository<TrusteeAppointmentsSyncState>,
      );
      vi.spyOn(factory, 'getTrusteePetitionSyncStateRepo').mockReturnValue(
        mockPetitionSyncStateRepo as RuntimeStateRepository<TrusteePetitionSyncState>,
      );
      vi.spyOn(factory, 'getCasesGateway').mockReturnValue(mockCasesGateway as CasesInterface);
    });

    test('should use provided lastSyncDate without reading from repo', async () => {
      const { events, latestSyncDate } = await SyncTrusteeCaseAppointments.getAppointmentEvents(
        SyncTrusteeCaseAppointments.createDeps(context),
        '2025-01-10T00:00:00Z',
      );

      expect(mockRuntimeStateRepo.read).not.toHaveBeenCalled();
      expect(mockCasesGateway.getTrusteeAppointments).toHaveBeenCalledWith(
        context,
        '2025-01-10T00:00:00Z',
      );
      expect(events).toEqual(mockEvents);
      expect(latestSyncDate).toBe(mockLatestSyncDate);
    });

    test('should read lastSyncDate from runtime state repo when not provided', async () => {
      const { events, latestSyncDate } = await SyncTrusteeCaseAppointments.getAppointmentEvents(
        SyncTrusteeCaseAppointments.createDeps(context),
      );

      expect(mockRuntimeStateRepo.read).toHaveBeenCalledWith('TRUSTEE_APPOINTMENTS_SYNC_STATE');
      expect(mockCasesGateway.getTrusteeAppointments).toHaveBeenCalledWith(
        context,
        '2025-01-01T00:00:00Z',
      );
      expect(events).toEqual(mockEvents);
      expect(latestSyncDate).toBe(mockLatestSyncDate);
    });

    test('should default to 2018-01-01 when no runtime state exists in Cosmos', async () => {
      (mockRuntimeStateRepo.read as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new NotFoundError('RUNTIME-STATE-MONGO-REPOSITORY_ADAPTER', {
          message: 'No matching item found.',
        }),
      );

      const { events, latestSyncDate } = await SyncTrusteeCaseAppointments.getAppointmentEvents(
        SyncTrusteeCaseAppointments.createDeps(context),
      );

      expect(mockRuntimeStateRepo.read).toHaveBeenCalledWith('TRUSTEE_APPOINTMENTS_SYNC_STATE');
      expect(mockCasesGateway.getTrusteeAppointments).toHaveBeenCalledWith(context, '2018-01-01');
      expect(events).toEqual(mockEvents);
      expect(latestSyncDate).toBe(mockLatestSyncDate);
    });

    test('should use the default sync date for both watermarks when reset is true', async () => {
      const { events } = await SyncTrusteeCaseAppointments.getAppointmentEvents(
        SyncTrusteeCaseAppointments.createDeps(context),
        undefined,
        true,
      );

      expect(mockRuntimeStateRepo.read).not.toHaveBeenCalled();
      expect(mockPetitionSyncStateRepo.read).not.toHaveBeenCalled();
      expect(mockCasesGateway.getTrusteeAppointments).toHaveBeenCalledWith(context, '2018-01-01');
      expect(mockCasesGateway.getTrusteePetitionEvents).toHaveBeenCalledWith(context, '2018-01-01');
      expect(events).toEqual(mockEvents);
    });

    test('should use overrideRuntimeState for the TR watermark instead of reading from the repo', async () => {
      const overrideRuntimeState: TrusteeAppointmentsSyncState = {
        id: 'override-state',
        documentType: 'TRUSTEE_APPOINTMENTS_SYNC_STATE',
        lastSyncDate: '2024-12-01T00:00:00Z',
      };

      await SyncTrusteeCaseAppointments.getAppointmentEvents(
        SyncTrusteeCaseAppointments.createDeps(context),
        undefined,
        undefined,
        overrideRuntimeState,
      );

      expect(mockRuntimeStateRepo.read).not.toHaveBeenCalled();
      expect(mockCasesGateway.getTrusteeAppointments).toHaveBeenCalledWith(
        context,
        '2024-12-01T00:00:00Z',
      );
    });

    test('should merge TR and petition-time events from independent watermarks into one result', async () => {
      const petitionEvent: TrusteeAppointmentSyncEvent = {
        caseId: 'case-002',
        courtId: '082',
        dxtrTrustee: { fullName: 'Petition Trustee' },
      };
      (mockCasesGateway.getTrusteePetitionEvents as ReturnType<typeof vi.fn>).mockResolvedValue({
        events: [petitionEvent],
        latestSyncDate: mockPetitionLatestSyncDate,
      });

      const { events } = await SyncTrusteeCaseAppointments.getAppointmentEvents(
        SyncTrusteeCaseAppointments.createDeps(context),
      );

      expect(mockCasesGateway.getTrusteePetitionEvents).toHaveBeenCalledWith(
        context,
        '2024-06-01T00:00:00Z',
      );
      expect(events).toEqual([...mockEvents, petitionEvent]);
    });

    test('should advance petition and TR watermarks independently', async () => {
      (mockRuntimeStateRepo.read as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'state-1',
        documentType: 'TRUSTEE_APPOINTMENTS_SYNC_STATE',
        lastSyncDate: '2025-01-01T00:00:00Z',
      });
      (mockPetitionSyncStateRepo.read as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'petition-state-1',
        documentType: 'TRUSTEE_PETITION_SYNC_STATE',
        lastSyncDate: '2024-06-01T00:00:00Z',
      });

      await SyncTrusteeCaseAppointments.getAppointmentEvents(
        SyncTrusteeCaseAppointments.createDeps(context),
      );

      expect(mockCasesGateway.getTrusteeAppointments).toHaveBeenCalledWith(
        context,
        '2025-01-01T00:00:00Z',
      );
      expect(mockCasesGateway.getTrusteePetitionEvents).toHaveBeenCalledWith(
        context,
        '2024-06-01T00:00:00Z',
      );
    });

    test('should throw and log when cases gateway fails', async () => {
      vi.spyOn(factory, 'getCasesGateway').mockReturnValue({
        getTrusteeAppointments: vi.fn().mockRejectedValue(new Error('DXTR unavailable')),
        getTrusteePetitionEvents: vi.fn().mockResolvedValue({ events: [], latestSyncDate: '' }),
      } as unknown as CasesInterface);
      const camsErrorSpy = vi.spyOn(context.logger, 'camsError');

      await expect(
        SyncTrusteeCaseAppointments.getAppointmentEvents(
          SyncTrusteeCaseAppointments.createDeps(context),
          '2025-01-01T00:00:00Z',
        ),
      ).rejects.toMatchObject({
        isCamsError: true,
        originalError: expect.stringContaining('DXTR unavailable'),
      });

      expect(camsErrorSpy).toHaveBeenCalledTimes(1);
    });

    test('should still return TR-appointment events and advance the TR watermark when the petition query fails', async () => {
      (mockCasesGateway.getTrusteePetitionEvents as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('petition query exploded'),
      );
      const camsErrorSpy = vi.spyOn(context.logger, 'camsError');

      const { events, latestSyncDate, petitionLatestSyncDate } =
        await SyncTrusteeCaseAppointments.getAppointmentEvents(
          SyncTrusteeCaseAppointments.createDeps(context),
        );

      expect(events).toEqual(mockEvents);
      expect(latestSyncDate).toBe(mockLatestSyncDate);
      expect(petitionLatestSyncDate).toBeUndefined();
      expect(camsErrorSpy).toHaveBeenCalledTimes(1);
    });

    test('should throw and log when the TR-appointment query fails even if the petition query succeeds', async () => {
      (mockCasesGateway.getTrusteeAppointments as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('DXTR unavailable'),
      );
      const camsErrorSpy = vi.spyOn(context.logger, 'camsError');

      await expect(
        SyncTrusteeCaseAppointments.getAppointmentEvents(
          SyncTrusteeCaseAppointments.createDeps(context),
        ),
      ).rejects.toMatchObject({
        isCamsError: true,
        originalError: expect.stringContaining('DXTR unavailable'),
      });

      expect(camsErrorSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('storeRuntimeState', () => {
    let context: ApplicationContext;
    let mockRuntimeStateRepo: Partial<RuntimeStateRepository<TrusteeAppointmentsSyncState>>;

    beforeEach(async () => {
      vi.restoreAllMocks();
      if (context) await closeDeferred(context);
      context = await createMockApplicationContext();

      mockRuntimeStateRepo = {
        upsert: vi.fn().mockResolvedValue(undefined),
      };

      vi.spyOn(factory, 'getTrusteeAppointmentsSyncStateRepo').mockReturnValue(
        mockRuntimeStateRepo as RuntimeStateRepository<TrusteeAppointmentsSyncState>,
      );
    });

    test('should upsert the runtime state with the given lastSyncDate', async () => {
      await SyncTrusteeCaseAppointments.storeRuntimeState(
        SyncTrusteeCaseAppointments.createDeps(context),
        '2025-02-01T00:00:00Z',
      );

      expect(mockRuntimeStateRepo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          documentType: 'TRUSTEE_APPOINTMENTS_SYNC_STATE',
          lastSyncDate: '2025-02-01T00:00:00Z',
        }),
      );
    });

    test('should log error and not throw when upsert fails', async () => {
      (mockRuntimeStateRepo.upsert as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Cosmos write failed'),
      );
      const camsErrorSpy = vi.spyOn(context.logger, 'camsError');

      await expect(
        SyncTrusteeCaseAppointments.storeRuntimeState(
          SyncTrusteeCaseAppointments.createDeps(context),
          '2025-02-01T00:00:00Z',
        ),
      ).resolves.toBeUndefined();

      expect(camsErrorSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('storePetitionRuntimeState', () => {
    let context: ApplicationContext;
    let mockPetitionSyncStateRepo: Partial<RuntimeStateRepository<TrusteePetitionSyncState>>;

    beforeEach(async () => {
      vi.restoreAllMocks();
      if (context) await closeDeferred(context);
      context = await createMockApplicationContext();

      mockPetitionSyncStateRepo = {
        upsert: vi.fn().mockResolvedValue(undefined),
      };

      vi.spyOn(factory, 'getTrusteePetitionSyncStateRepo').mockReturnValue(
        mockPetitionSyncStateRepo as RuntimeStateRepository<TrusteePetitionSyncState>,
      );
    });

    test('should upsert the petition runtime state with the given lastSyncDate', async () => {
      await SyncTrusteeCaseAppointments.storePetitionRuntimeState(
        SyncTrusteeCaseAppointments.createDeps(context),
        '2025-02-01T00:00:00Z',
      );

      expect(mockPetitionSyncStateRepo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          documentType: 'TRUSTEE_PETITION_SYNC_STATE',
          lastSyncDate: '2025-02-01T00:00:00Z',
        }),
      );
    });

    test('should log error and not throw when upsert fails', async () => {
      (mockPetitionSyncStateRepo.upsert as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Cosmos write failed'),
      );
      const camsErrorSpy = vi.spyOn(context.logger, 'camsError');

      await expect(
        SyncTrusteeCaseAppointments.storePetitionRuntimeState(
          SyncTrusteeCaseAppointments.createDeps(context),
          '2025-02-01T00:00:00Z',
        ),
      ).resolves.toBeUndefined();

      expect(camsErrorSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('deleteAll', () => {
    let context: ApplicationContext;
    let mockAppointmentsRepo: Partial<TrusteeAppointmentsRepository>;

    beforeEach(async () => {
      vi.restoreAllMocks();
      if (context) await closeDeferred(context);
      context = await createMockApplicationContext();

      mockAppointmentsRepo = {
        deleteAll: vi.fn().mockResolvedValue(3),
      };

      vi.spyOn(factory, 'getTrusteeAppointmentsRepository').mockReturnValue(
        mockAppointmentsRepo as TrusteeAppointmentsRepository,
      );
    });

    test('should return the count of deleted appointments', async () => {
      const result = await SyncTrusteeCaseAppointments.deleteAll(
        SyncTrusteeCaseAppointments.createDeps(context),
      );

      expect(result).toEqual({ data: { deleted: 3 } });
    });

    test('should log and return zero-deleted with error when the repo throws', async () => {
      (mockAppointmentsRepo.deleteAll as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Cosmos delete failed'),
      );
      const camsErrorSpy = vi.spyOn(context.logger, 'camsError');

      const result = await SyncTrusteeCaseAppointments.deleteAll(
        SyncTrusteeCaseAppointments.createDeps(context),
      );

      expect(result.data).toEqual({ deleted: 0 });
      expect(result.error).toBeDefined();
      expect(camsErrorSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('downstream event emission', () => {
    let context: ApplicationContext;
    let mockCasesRepo: Partial<CasesRepository>;
    let mockAppointmentsRepo: Partial<TrusteeAppointmentsRepository>;
    let mockTrusteeCaseAppointmentsRepo: Partial<TrusteeCaseAppointmentsRepository>;
    let mockVerificationRepo: Partial<TrusteeMatchVerificationRepository>;
    let queueTrusteeAppointmentEventSpy: ReturnType<typeof vi.fn>;

    const makeEvent = (caseId: string): TrusteeAppointmentSyncEvent => ({
      caseId,
      courtId: '081',
      courtDivisionCode: '081',
      chapter: '7',
      dxtrTrustee: { fullName: 'John Doe' },
      appointedDate: '2024-01-15',
    });

    const syncedCase = {
      caseId: 'case-001',
      trusteeId: undefined,
      courtId: '081',
      courtDivisionCode: '081',
      chapter: '7',
    };

    beforeEach(async () => {
      vi.restoreAllMocks();
      if (context) await closeDeferred(context);
      context = await createMockApplicationContext();

      mockCasesRepo = {
        getCaseOrMovedCase: vi.fn().mockResolvedValue(syncedCase),
        syncDxtrCase: vi.fn().mockResolvedValue(undefined),
        release: vi.fn(),
      };

      mockAppointmentsRepo = {
        getTrusteeAppointments: vi.fn().mockResolvedValue([]),
        release: vi.fn(),
      };

      mockTrusteeCaseAppointmentsRepo = {
        getActiveByCaseId: vi.fn().mockResolvedValue(null),
        getByCaseId: vi.fn().mockResolvedValue([]),
        upsert: vi.fn().mockResolvedValue({}),
        updateCaseAppointment: vi.fn().mockResolvedValue({}),
        findStrandedActiveInTrusteePartition: vi.fn().mockResolvedValue(null),
        release: vi.fn(),
      };

      mockVerificationRepo = {
        getVerification: vi.fn().mockResolvedValue(null),
        findByFingerprint: vi.fn().mockResolvedValue([]),
        upsertVerification: vi.fn().mockResolvedValue(undefined),
        release: vi.fn(),
      };

      queueTrusteeAppointmentEventSpy = vi.fn().mockResolvedValue(undefined);

      vi.spyOn(factory, 'getCasesRepository').mockReturnValue(mockCasesRepo as CasesRepository);
      vi.spyOn(factory, 'getTrusteeAppointmentsRepository').mockReturnValue(
        mockAppointmentsRepo as TrusteeAppointmentsRepository,
      );
      vi.spyOn(factory, 'getTrusteeCaseAppointmentsRepository').mockReturnValue(
        mockTrusteeCaseAppointmentsRepo as TrusteeCaseAppointmentsRepository,
      );
      vi.spyOn(factory, 'getTrusteeMatchVerificationRepository').mockReturnValue(
        mockVerificationRepo as TrusteeMatchVerificationRepository,
      );
      vi.spyOn(factory, 'getTrusteesRepository').mockReturnValue({
        read: vi.fn().mockResolvedValue({
          trusteeId: 'trustee-123',
          name: 'John Doe',
          public: { address: {} },
        }),
        release: vi.fn(),
      } as unknown as TrusteesRepository);
      vi.spyOn(factory, 'getOfficesGateway').mockReturnValue({
        getOffices: vi.fn().mockResolvedValue(MOCKED_USTP_OFFICES_ARRAY),
        getOfficeName: vi.fn(),
      });
      vi.spyOn(factory, 'getApiToDataflowsGateway').mockReturnValue({
        queueTrusteeAppointmentEvent: queueTrusteeAppointmentEventSpy,
        queueCaseAssignmentEvent: vi.fn().mockResolvedValue(undefined),
        queueCaseReload: vi.fn().mockResolvedValue(undefined),
        queueTrusteeVerificationRemap: vi.fn().mockResolvedValue(undefined),
      } as ApiToDataflowsGateway);
      vi.spyOn(trusteeMatchHelpers, 'matchTrusteeByName').mockResolvedValue({
        kind: 'resolved',
        trusteeId: 'trustee-123',
      });
      vi.spyOn(trusteeMatchHelpers, 'isAppointmentMatch').mockReturnValue(true);
    });

    test('should emit active appointment event when acmsProfessionalId is resolved', async () => {
      vi.spyOn(factory, 'getTrusteeProfessionalIdsRepository').mockReturnValue({
        findByCamsTrusteeId: vi.fn().mockResolvedValue([{ acmsProfessionalId: 'NY-00063' }]),
        release: vi.fn(),
      } as unknown as TrusteeProfessionalIdsRepository);

      await SyncTrusteeCaseAppointments.processAppointments(
        SyncTrusteeCaseAppointments.createDeps(context),
        [makeEvent('case-001')],
      );

      expect(queueTrusteeAppointmentEventSpy).toHaveBeenCalledTimes(1);
      expect(queueTrusteeAppointmentEventSpy).toHaveBeenCalledWith(
        expect.objectContaining<Partial<TrusteeAppointmentDownstreamEvent>>({
          caseId: 'case-001',
          trusteeId: 'trustee-123',
          acmsProfessionalId: 'NY-00063',
          chapter: '7',
          appointedDate: '2024-01-15',
        }),
      );
      expect(queueTrusteeAppointmentEventSpy.mock.calls[0][0].unassignedOn).toBeUndefined();
    });

    test('should emit closed appointment event on soft-close of previous trustee', async () => {
      const existingAppointment: Partial<CaseAppointment> = {
        caseId: 'case-001',
        trusteeId: 'trustee-old',
        assignedOn: '2023-01-01T00:00:00.000Z',
        appointedDate: '2023-01-01',
      };
      mockTrusteeCaseAppointmentsRepo.getActiveByCaseId = vi
        .fn()
        .mockResolvedValue(existingAppointment);
      vi.spyOn(factory, 'getTrusteeProfessionalIdsRepository').mockReturnValue({
        findByCamsTrusteeId: vi.fn().mockResolvedValue([{ acmsProfessionalId: 'NY-00063' }]),
        release: vi.fn(),
      } as unknown as TrusteeProfessionalIdsRepository);

      await SyncTrusteeCaseAppointments.processAppointments(
        SyncTrusteeCaseAppointments.createDeps(context),
        [makeEvent('case-001')],
      );

      expect(queueTrusteeAppointmentEventSpy).toHaveBeenCalledTimes(2);
      const closeCall = queueTrusteeAppointmentEventSpy.mock
        .calls[0][0] as TrusteeAppointmentDownstreamEvent;
      expect(closeCall.trusteeId).toBe('trustee-old');
      expect(closeCall.unassignedOn).toBeDefined();
      const openCall = queueTrusteeAppointmentEventSpy.mock
        .calls[1][0] as TrusteeAppointmentDownstreamEvent;
      expect(openCall.trusteeId).toBe('trustee-123');
      expect(openCall.unassignedOn).toBeUndefined();
    });

    test('should not emit close event or resolve professional id when non-transient soft-close fails', async () => {
      const existingAppointment: Partial<CaseAppointment> = {
        caseId: 'case-001',
        trusteeId: 'trustee-old',
        assignedOn: '2023-01-01T00:00:00.000Z',
        appointedDate: '2023-01-01',
      };
      mockTrusteeCaseAppointmentsRepo.getActiveByCaseId = vi
        .fn()
        .mockResolvedValue(existingAppointment);
      mockTrusteeCaseAppointmentsRepo.updateCaseAppointment = vi
        .fn()
        .mockRejectedValue(new Error('Cosmos write failed'));
      const findByCamsTrusteeIdSpy = vi
        .fn()
        .mockResolvedValue([{ acmsProfessionalId: 'NY-00063' }]);
      vi.spyOn(factory, 'getTrusteeProfessionalIdsRepository').mockReturnValue({
        findByCamsTrusteeId: findByCamsTrusteeIdSpy,
        release: vi.fn(),
      } as unknown as TrusteeProfessionalIdsRepository);
      const getOfficesSpy = vi.fn().mockResolvedValue(MOCKED_USTP_OFFICES_ARRAY);
      vi.spyOn(factory, 'getOfficesGateway').mockReturnValue({
        getOffices: getOfficesSpy,
        getOfficeName: vi.fn(),
      });

      await SyncTrusteeCaseAppointments.processAppointments(
        SyncTrusteeCaseAppointments.createDeps(context),
        [makeEvent('case-001')],
      );

      // Non-transient soft-close failure: the old appointment was NOT actually closed in
      // Cosmos, so downstream must not be told it was. Gating on !softCloseError also skips
      // the resolveGroupMatchedProfessionalId gateway reads (getOffices, findByCamsTrusteeId)
      // on a path that's already failing.
      expect(queueTrusteeAppointmentEventSpy).not.toHaveBeenCalled();
      expect(getOfficesSpy).not.toHaveBeenCalled();
      expect(findByCamsTrusteeIdSpy).not.toHaveBeenCalled();
    });

    test('should queue event with sentinel professional ID when no matching professional ID found', async () => {
      vi.spyOn(factory, 'getTrusteeProfessionalIdsRepository').mockReturnValue({
        findByCamsTrusteeId: vi.fn().mockResolvedValue([]),
        release: vi.fn(),
      } as unknown as TrusteeProfessionalIdsRepository);

      await SyncTrusteeCaseAppointments.processAppointments(
        SyncTrusteeCaseAppointments.createDeps(context),
        [makeEvent('case-001')],
      );

      expect(mockTrusteeCaseAppointmentsRepo.upsert).toHaveBeenCalled();
      expect(queueTrusteeAppointmentEventSpy).toHaveBeenCalledTimes(1);
      expect(queueTrusteeAppointmentEventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          caseId: 'case-001',
          trusteeId: 'trustee-123',
          acmsProfessionalId: 'XX-99999',
        }),
      );
    });

    test('should not emit event when same trustee is already active', async () => {
      mockTrusteeCaseAppointmentsRepo.getActiveByCaseId = vi.fn().mockResolvedValue({
        caseId: 'case-001',
        trusteeId: 'trustee-123', // same trustee — early return path
        assignedOn: '2023-01-01T00:00:00.000Z',
      });
      vi.spyOn(factory, 'getTrusteeProfessionalIdsRepository').mockReturnValue({
        findByCamsTrusteeId: vi.fn().mockResolvedValue([{ acmsProfessionalId: 'NY-00063' }]),
        release: vi.fn(),
      } as unknown as TrusteeProfessionalIdsRepository);

      await SyncTrusteeCaseAppointments.processAppointments(
        SyncTrusteeCaseAppointments.createDeps(context),
        [makeEvent('case-001')],
      );

      expect(queueTrusteeAppointmentEventSpy).not.toHaveBeenCalled();
    });

    test('should log error and not write sync error doc when open event queuing fails', async () => {
      vi.spyOn(factory, 'getTrusteeProfessionalIdsRepository').mockReturnValue({
        findByCamsTrusteeId: vi.fn().mockResolvedValue([{ acmsProfessionalId: 'NY-00063' }]),
        release: vi.fn(),
      } as unknown as TrusteeProfessionalIdsRepository);
      queueTrusteeAppointmentEventSpy.mockRejectedValue(new Error('queue unavailable'));
      const errorSpy = vi.spyOn(context.logger, 'error');

      await SyncTrusteeCaseAppointments.processAppointments(
        SyncTrusteeCaseAppointments.createDeps(context),
        [makeEvent('case-001')],
      );

      expect(mockTrusteeCaseAppointmentsRepo.upsert).toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalledWith(
        'SYNC-TRUSTEE-CASE-APPOINTMENTS-USE-CASE',
        expect.stringContaining('Failed to queue open event'),
        expect.any(Error),
      );
    });

    test('should log error and not write sync error doc when close event queuing fails', async () => {
      vi.spyOn(factory, 'getTrusteeProfessionalIdsRepository').mockReturnValue({
        findByCamsTrusteeId: vi.fn().mockResolvedValue([{ acmsProfessionalId: 'NY-00063' }]),
        release: vi.fn(),
      } as unknown as TrusteeProfessionalIdsRepository);
      mockTrusteeCaseAppointmentsRepo.getActiveByCaseId = vi.fn().mockResolvedValue({
        caseId: 'case-001',
        trusteeId: 'old-trustee-456',
        assignedOn: '2023-01-01T00:00:00.000Z',
      });
      queueTrusteeAppointmentEventSpy.mockRejectedValue(new Error('queue unavailable'));
      const errorSpy = vi.spyOn(context.logger, 'error');

      await SyncTrusteeCaseAppointments.processAppointments(
        SyncTrusteeCaseAppointments.createDeps(context),
        [makeEvent('case-001')],
      );

      expect(mockTrusteeCaseAppointmentsRepo.updateCaseAppointment).toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalledWith(
        'SYNC-TRUSTEE-CASE-APPOINTMENTS-USE-CASE',
        expect.stringContaining('Failed to queue close event'),
        expect.any(Error),
      );
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
    dxtrTrustee: { fullName: 'Jane Doe' },
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
});

describe('createNewAppointment', () => {
  test('upserts the new appointment and logs an info message', async () => {
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
      dxtrTrustee: { fullName: 'Jane Doe' },
    };

    await createNewAppointment(
      context,
      appointmentsRepo,
      event,
      'new-trustee-789',
      '2023-01-02T00:00:00.000Z',
    );

    expect(upsert).toHaveBeenCalledWith({
      caseId: 'case-001',
      trusteeId: 'new-trustee-789',
      assignedOn: '2023-01-02T00:00:00.000Z',
      appointedDate: '2023-01-02T00:00:00.000Z',
    });
    expect(infoSpy).toHaveBeenCalledWith(
      'SYNC-TRUSTEE-CASE-APPOINTMENTS-USE-CASE',
      'Created case appointment for case case-001, trustee new-trustee-789',
    );
  });
});

describe('softCloseExistingAppointment', () => {
  const event: TrusteeAppointmentSyncEvent = {
    caseId: 'case-001',
    courtId: '081',
    courtDivisionCode: '081',
    chapter: '7',
    dxtrTrustee: { fullName: 'Jane Doe' },
  };
  const syncedCase = {
    caseId: 'case-001',
    courtId: '081',
    courtDivisionCode: '081',
    chapter: '7',
    dateFiled: '2026-01-07',
  } as unknown as SyncedCase;
  const existingAppointment = {
    caseId: 'case-001',
    trusteeId: 'old-trustee-456',
    assignedOn: '2023-01-01T00:00:00.000Z',
  } as unknown as CaseAppointment;

  function buildAppointmentsRepo(overrides: Partial<TrusteeCaseAppointmentsRepository> = {}) {
    return {
      updateCaseAppointment: vi.fn().mockResolvedValue({}),
      upsert: vi.fn().mockResolvedValue({}),
      ...overrides,
    } as unknown as TrusteeCaseAppointmentsRepository;
  }

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
      syncedCase,
    );

    expect(appointmentsRepo.updateCaseAppointment).toHaveBeenCalledWith({
      ...existingAppointment,
      unassignedOn: expect.any(String),
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
        syncedCase,
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
      syncedCase,
    );

    expect(appointmentsRepo.upsert).toHaveBeenCalledWith({
      caseId: 'case-001',
      trusteeId: 'new-trustee-789',
      assignedOn: '2023-01-02T00:00:00.000Z',
      appointedDate: undefined,
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

  test('does not notify downstream when the feature flag is disabled', async () => {
    const context = await createMockApplicationContext();
    context.featureFlags['downstream-trustee-appointments-enabled'] = false;
    const queueTrusteeAppointmentEvent = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(factory, 'getApiToDataflowsGateway').mockReturnValue({
      queueTrusteeAppointmentEvent,
    } as unknown as ApiToDataflowsGateway);
    const appointmentsRepo = buildAppointmentsRepo();

    await softCloseExistingAppointment(
      context,
      event,
      existingAppointment,
      'new-trustee-789',
      '2023-01-02T00:00:00.000Z',
      appointmentsRepo,
      syncedCase,
    );

    expect(queueTrusteeAppointmentEvent).not.toHaveBeenCalled();
  });

  test('notifies downstream of the closed appointment when the feature flag is enabled', async () => {
    const context = await createMockApplicationContext();
    context.featureFlags['downstream-trustee-appointments-enabled'] = true;
    const queueTrusteeAppointmentEvent = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(factory, 'getApiToDataflowsGateway').mockReturnValue({
      queueTrusteeAppointmentEvent,
    } as unknown as ApiToDataflowsGateway);
    vi.spyOn(factory, 'getOfficesGateway').mockReturnValue({
      getOffices: vi.fn().mockResolvedValue(MOCKED_USTP_OFFICES_ARRAY),
      getOfficeName: vi.fn(),
    });
    vi.spyOn(factory, 'getTrusteeProfessionalIdsRepository').mockReturnValue({
      findByCamsTrusteeId: vi.fn().mockResolvedValue([]),
      release: vi.fn(),
    } as unknown as TrusteeProfessionalIdsRepository);
    const appointmentsRepo = buildAppointmentsRepo();

    await softCloseExistingAppointment(
      context,
      event,
      existingAppointment,
      'new-trustee-789',
      '2023-01-02T00:00:00.000Z',
      appointmentsRepo,
      syncedCase,
    );

    expect(queueTrusteeAppointmentEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        caseId: 'case-001',
        trusteeId: 'old-trustee-456',
        unassignedOn: expect.any(String),
      }),
    );
  });

  test('does not notify downstream when the soft-close failed', async () => {
    const context = await createMockApplicationContext();
    context.featureFlags['downstream-trustee-appointments-enabled'] = true;
    const queueTrusteeAppointmentEvent = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(factory, 'getApiToDataflowsGateway').mockReturnValue({
      queueTrusteeAppointmentEvent,
    } as unknown as ApiToDataflowsGateway);
    const appointmentsRepo = buildAppointmentsRepo({
      updateCaseAppointment: vi.fn().mockRejectedValue(new Error('permanent failure')),
    });

    await softCloseExistingAppointment(
      context,
      event,
      existingAppointment,
      'new-trustee-789',
      '2023-01-02T00:00:00.000Z',
      appointmentsRepo,
      syncedCase,
    );

    expect(queueTrusteeAppointmentEvent).not.toHaveBeenCalled();
  });
});

describe('isTransientInfraError', () => {
  test('returns true for a TooManyRequestsError', () => {
    expect(isTransientInfraError(new TooManyRequestsError('COSMOS'))).toBe(true);
  });

  test('returns true for a GatewayTimeoutError', () => {
    expect(isTransientInfraError(new GatewayTimeoutError('COSMOS'))).toBe(true);
  });

  test('returns false for a non-transient error', () => {
    expect(isTransientInfraError(new CamsError('TEST', { message: 'permanent failure' }))).toBe(
      false,
    );
  });
});

describe('handleClassifiedMismatch', () => {
  const event: TrusteeAppointmentSyncEvent = {
    caseId: 'case-001',
    courtId: '081',
    courtDivisionCode: '081',
    chapter: '7',
    // appointedDate must be present: writeSurrogateAppointment now throws rather than falling
    // back to wall-clock time when it's missing, since wall-clock would break upsert()'s
    // natural-key idempotency across retries (see the missing-appointedDate test below).
    appointedDate: '2024-01-15',
    dxtrTrustee: { fullName: 'Jane Doe' },
  };
  const syncedCase = {
    caseId: 'case-001',
    courtId: '081',
    courtDivisionCode: '081',
    chapter: '7',
    dateFiled: '2026-01-07',
  } as unknown as SyncedCase;
  const candidateScore = { trusteeId: 'candidate-1' } as unknown as CandidateScore;

  function buildAudit() {
    return {
      caseId: event.caseId,
      dxtrTrusteeName: event.dxtrTrustee.fullName,
      matchOutcome: 'error' as const,
      matchedTrusteeId: null,
      scoringBreakdown: null,
      appointmentStatus: null,
    };
  }

  function buildScenarioDistribution() {
    return {
      autoMatchCount: 0,
      imperfectMatchCount: 0,
      highConfidenceMatchCount: 0,
      noMatchCount: 0,
      multipleMatchCount: 0,
      perfectMatchInactiveCount: 0,
      reVerificationCount: 0,
      reservedIdSkippedCount: 0,
      verificationBucketHitCount: 0,
      fingerprintHitCount: 0,
      fingerprintMissCount: 0,
      retryableCount: 0,
      candidateLoadFailedCount: 0,
      emptyDemographicsSkippedCount: 0,
    };
  }

  function buildVerificationRepo(isReVerification: boolean) {
    return {
      findByFingerprint: vi
        .fn()
        .mockResolvedValue(isReVerification ? [{ variant: 'variant-1', status: 'resolved' }] : []),
      upsertVerification: vi.fn().mockResolvedValue(undefined),
    } as unknown as TrusteeMatchVerificationRepository;
  }

  function buildCaseAppointmentsRepo() {
    return {
      getByCaseId: vi.fn().mockResolvedValue([]),
      upsert: vi.fn().mockResolvedValue({}),
    } as unknown as TrusteeCaseAppointmentsRepository;
  }

  // handleClassifiedMismatch takes MatchContext (deps/event/fingerprint/variant/audit/
  // scenarioDistribution) rather than an options bag with an injected writeSurrogateAppointment
  // callback — that field was removed once writeSurrogateAppointment became a plain deps-first
  // free function; these tests build a minimal deps object directly rather than going through the
  // real factory-backed createDeps, since only verificationRepo/caseAppointmentsRepo/context are
  // exercised here.
  function buildCtx(
    verificationRepo: TrusteeMatchVerificationRepository,
    caseAppointmentsRepo: TrusteeCaseAppointmentsRepository,
    scenarioDistribution: ReturnType<typeof buildScenarioDistribution>,
    audit: ReturnType<typeof buildAudit>,
    ctxEvent: TrusteeAppointmentSyncEvent = event,
  ) {
    return {
      deps: {
        context: { logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } },
        verificationRepo,
        caseAppointmentsRepo,
      } as unknown as ReturnType<typeof SyncTrusteeCaseAppointments.createDeps>,
      event: ctxEvent,
      fingerprint: 'fingerprint-1',
      variant: 'variant-1',
      audit,
      scenarioDistribution,
    };
  }

  test('NoTrusteeMatch: increments noMatchCount, sets audit outcome, verifies with empty candidates, writes surrogate', async () => {
    const verificationRepo = buildVerificationRepo(false);
    const caseAppointmentsRepo = buildCaseAppointmentsRepo();
    const scenarioDistribution = buildScenarioDistribution();
    const audit = buildAudit();
    const ctx = buildCtx(verificationRepo, caseAppointmentsRepo, scenarioDistribution, audit);

    // Mirrors the real processAppointments call site, which always passes [] for
    // NoTrusteeMatch regardless of any candidates on the classified error.
    await handleClassifiedMismatch(
      ctx,
      syncedCase,
      TrusteeAppointmentSyncErrorCode.NoTrusteeMatch,
      [],
    );

    expect(scenarioDistribution.noMatchCount).toBe(1);
    expect(scenarioDistribution.imperfectMatchCount).toBe(0);
    expect(audit.matchOutcome).toBe('no-match');
    expect(verificationRepo.upsertVerification).toHaveBeenCalledWith(
      expect.objectContaining({ mismatchReason: TrusteeAppointmentSyncErrorCode.NoTrusteeMatch }),
    );
    const upsertedDoc = (verificationRepo.upsertVerification as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(upsertedDoc.matchCandidates).toEqual([]);
    expect(caseAppointmentsRepo.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        caseId: event.caseId,
        isSurrogate: true,
        trusteeId: 'fingerprint-1',
      }),
    );
  });

  test('ImperfectMatch: increments imperfectMatchCount, leaves audit outcome unset, verifies with matchCandidates, writes surrogate', async () => {
    const verificationRepo = buildVerificationRepo(false);
    const caseAppointmentsRepo = buildCaseAppointmentsRepo();
    const scenarioDistribution = buildScenarioDistribution();
    const audit = buildAudit();
    const ctx = buildCtx(verificationRepo, caseAppointmentsRepo, scenarioDistribution, audit);

    await handleClassifiedMismatch(
      ctx,
      syncedCase,
      TrusteeAppointmentSyncErrorCode.ImperfectMatch,
      [candidateScore],
    );

    expect(scenarioDistribution.imperfectMatchCount).toBe(1);
    expect(scenarioDistribution.noMatchCount).toBe(0);
    // Matches pre-refactor behavior exactly: the original ImperfectMatch switch case never set
    // audit.matchOutcome, leaving it at its 'error' default.
    expect(audit.matchOutcome).toBe('error');
    expect(verificationRepo.upsertVerification).toHaveBeenCalledWith(
      expect.objectContaining({ mismatchReason: TrusteeAppointmentSyncErrorCode.ImperfectMatch }),
    );
    const upsertedDoc = (verificationRepo.upsertVerification as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(upsertedDoc.matchCandidates).toEqual([candidateScore]);
    expect(caseAppointmentsRepo.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        caseId: event.caseId,
        isSurrogate: true,
        trusteeId: 'fingerprint-1',
      }),
    );
  });

  test('increments reVerificationCount when upsertMatchVerification reports a re-verification', async () => {
    const verificationRepo = buildVerificationRepo(true);
    const caseAppointmentsRepo = buildCaseAppointmentsRepo();
    const scenarioDistribution = buildScenarioDistribution();
    const audit = buildAudit();
    const ctx = buildCtx(verificationRepo, caseAppointmentsRepo, scenarioDistribution, audit);

    await handleClassifiedMismatch(
      ctx,
      syncedCase,
      TrusteeAppointmentSyncErrorCode.NoTrusteeMatch,
      [],
    );

    expect(scenarioDistribution.reVerificationCount).toBe(1);
  });

  test('throws instead of falling back to wall-clock time when appointedDate is missing, without writing a surrogate', async () => {
    // CAMS-809: writeSurrogateAppointment previously fell back to `event.appointedDate ?? now`,
    // which would mint a new, distinct surrogate row under the same fingerprint on every retry
    // of the same malformed event (upsert()'s natural key includes assignedOn, so a
    // wall-clock-derived assignedOn never matches a prior write). It must refuse the same way
    // applyResolvedTrustee does, so the event surfaces via the DLQ instead of proceeding.
    const verificationRepo = buildVerificationRepo(false);
    const caseAppointmentsRepo = buildCaseAppointmentsRepo();
    const scenarioDistribution = buildScenarioDistribution();
    const audit = buildAudit();
    const eventWithoutAppointedDate: TrusteeAppointmentSyncEvent = {
      ...event,
      appointedDate: undefined,
    };
    const ctx = buildCtx(
      verificationRepo,
      caseAppointmentsRepo,
      scenarioDistribution,
      audit,
      eventWithoutAppointedDate,
    );

    await expect(
      handleClassifiedMismatch(ctx, syncedCase, TrusteeAppointmentSyncErrorCode.NoTrusteeMatch, []),
    ).rejects.toThrow(/missing\/unparseable appointedDate/);

    expect(caseAppointmentsRepo.upsert).not.toHaveBeenCalled();
    expect(ctx.deps.context.logger.error).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('TRUSTEE APPOINTMENT DATA INTEGRITY ERROR'),
    );
  });
});
