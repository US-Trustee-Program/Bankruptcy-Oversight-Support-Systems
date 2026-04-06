import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest';
import { ApplicationContext } from '../../adapters/types/basic';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import SyncTrusteeAppointments from './sync-trustee-appointments';
import factory from '../../factory';
import { TrusteeAppointmentSyncEvent } from '@common/cams/dataflow-events';
import { CaseAppointment, TrusteeAppointment } from '@common/cams/trustee-appointments';
import {
  CasesRepository,
  RuntimeStateRepository,
  TrusteeAppointmentsRepository,
  TrusteeAppointmentsSyncState,
  TrusteeMatchVerificationRepository,
  TrusteesRepository,
} from '../gateways.types';
import * as trusteeMatchHelpers from './trustee-match.helpers';
import { closeDeferred } from '../../deferrable/defer-close';
import { CamsError } from '../../common-errors/cams-error';
import { CasesInterface } from '../cases/cases.interface';

describe('SyncTrusteeAppointments', () => {
  describe('processAppointments', () => {
    let context: ApplicationContext;
    let mockCasesRepo: Partial<CasesRepository>;
    let mockAppointmentsRepo: Partial<TrusteeAppointmentsRepository>;
    let mockTrusteesRepo: Partial<TrusteesRepository>;
    let mockVerificationRepo: Partial<TrusteeMatchVerificationRepository>;

    const makeEvent = (caseId: string, fullName: string): TrusteeAppointmentSyncEvent => ({
      caseId,
      courtId: '081',
      dxtrTrustee: { fullName },
    });

    beforeEach(async () => {
      context = await createMockApplicationContext();

      mockCasesRepo = {
        getSyncedCase: vi.fn().mockResolvedValue({
          caseId: 'case-001',
          trusteeId: undefined,
          courtId: '081',
          courtDivisionCode: 'NY',
          chapter: '7',
        }),
        syncDxtrCase: vi.fn().mockResolvedValue(undefined),
        release: vi.fn(),
      };

      mockAppointmentsRepo = {
        getActiveCaseAppointment: vi.fn().mockResolvedValue(null),
        createCaseAppointment: vi.fn().mockResolvedValue({}),
        updateCaseAppointment: vi.fn().mockResolvedValue({}),
        getTrusteeAppointments: vi.fn().mockResolvedValue([]),
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
        upsertVerification: vi.fn().mockResolvedValue(undefined),
        release: vi.fn(),
      };

      vi.spyOn(factory, 'getCasesRepository').mockReturnValue(mockCasesRepo as CasesRepository);
      vi.spyOn(factory, 'getTrusteeAppointmentsRepository').mockReturnValue(
        mockAppointmentsRepo as TrusteeAppointmentsRepository,
      );
      vi.spyOn(factory, 'getTrusteesRepository').mockReturnValue(
        mockTrusteesRepo as TrusteesRepository,
      );
      vi.spyOn(factory, 'getTrusteeMatchVerificationRepository').mockReturnValue(
        mockVerificationRepo as TrusteeMatchVerificationRepository,
      );
      vi.spyOn(trusteeMatchHelpers, 'matchTrusteeByName').mockResolvedValue('trustee-123');
      vi.spyOn(trusteeMatchHelpers, 'isPerfectMatch').mockReturnValue(true);
    });

    afterEach(async () => {
      await closeDeferred(context);
      vi.restoreAllMocks();
    });

    test('should create a new CASE_APPOINTMENT when no existing appointment', async () => {
      const events = [makeEvent('case-001', 'John Doe')];

      const { successCount, dlqMessages, scenarioDistribution } =
        await SyncTrusteeAppointments.processAppointments(context, events);

      expect(mockAppointmentsRepo.getActiveCaseAppointment).toHaveBeenCalledWith('case-001');
      expect(mockAppointmentsRepo.createCaseAppointment).toHaveBeenCalledWith(
        expect.objectContaining({
          caseId: 'case-001',
          trusteeId: 'trustee-123',
          assignedOn: expect.any(String),
        }),
      );
      expect(mockAppointmentsRepo.updateCaseAppointment).not.toHaveBeenCalled();
      expect(successCount).toBe(1);
      expect(dlqMessages).toHaveLength(0);
      expect(scenarioDistribution.autoMatchCount).toBe(1);
      expect(scenarioDistribution.imperfectMatchCount).toBe(0);
      expect(scenarioDistribution.highConfidenceMatchCount).toBe(0);
      expect(scenarioDistribution.noMatchCount).toBe(0);
      expect(scenarioDistribution.multipleMatchCount).toBe(0);
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
      (mockAppointmentsRepo.getActiveCaseAppointment as ReturnType<typeof vi.fn>).mockResolvedValue(
        existingAppointment,
      );

      const events = [makeEvent('case-001', 'John Doe')];

      await SyncTrusteeAppointments.processAppointments(context, events);

      expect(mockAppointmentsRepo.updateCaseAppointment).not.toHaveBeenCalled();
      expect(mockAppointmentsRepo.createCaseAppointment).not.toHaveBeenCalled();
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
      (mockAppointmentsRepo.getActiveCaseAppointment as ReturnType<typeof vi.fn>).mockResolvedValue(
        existingAppointment,
      );

      const events = [makeEvent('case-001', 'John Doe')];

      await SyncTrusteeAppointments.processAppointments(context, events);

      // Should soft-close old appointment
      expect(mockAppointmentsRepo.updateCaseAppointment).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'ca-old',
          trusteeId: 'old-trustee',
          unassignedOn: expect.any(String),
        }),
      );

      // Should create new appointment
      expect(mockAppointmentsRepo.createCaseAppointment).toHaveBeenCalledWith(
        expect.objectContaining({
          caseId: 'case-001',
          trusteeId: 'trustee-123',
          assignedOn: expect.any(String),
        }),
      );
    });

    test('should add unclassified error to dlqMessages and continue processing', async () => {
      (trusteeMatchHelpers.matchTrusteeByName as ReturnType<typeof vi.fn>)
        .mockRejectedValueOnce(new Error('Match failed'))
        .mockResolvedValueOnce('trustee-456');

      (mockCasesRepo.getSyncedCase as ReturnType<typeof vi.fn>).mockResolvedValue({
        caseId: 'case-002',
        trusteeId: undefined,
      });

      const events = [makeEvent('case-001', 'Bad Name'), makeEvent('case-002', 'Jane Smith')];

      const { successCount, dlqMessages, scenarioDistribution } =
        await SyncTrusteeAppointments.processAppointments(context, events);

      // First event — unclassified error goes to DLQ with raw error shape
      expect(dlqMessages).toHaveLength(1);
      expect((dlqMessages[0] as TrusteeAppointmentSyncEvent).error).toBeDefined();

      // Second event should succeed
      expect(successCount).toBe(1);
      expect(mockAppointmentsRepo.createCaseAppointment).toHaveBeenCalledWith(
        expect.objectContaining({
          caseId: 'case-002',
          trusteeId: 'trustee-456',
        }),
      );
      // Unclassified error doesn't increment any named distribution counter
      expect(scenarioDistribution.autoMatchCount).toBe(1);
    });

    test('should persist NO_TRUSTEE_MATCH to verification collection, not DLQ', async () => {
      const noMatchError = new CamsError('TRUSTEE-MATCH', {
        message: 'No match',
        data: { mismatchReason: 'NO_TRUSTEE_MATCH' },
      });
      (trusteeMatchHelpers.matchTrusteeByName as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        noMatchError,
      );

      const { dlqMessages, successCount, scenarioDistribution } =
        await SyncTrusteeAppointments.processAppointments(context, [
          makeEvent('case-001', 'Ghost Trustee'),
        ]);

      expect(dlqMessages).toHaveLength(0);
      expect(mockVerificationRepo.upsertVerification).toHaveBeenCalled();
      expect(mockAppointmentsRepo.createCaseAppointment).not.toHaveBeenCalled();
      expect(successCount).toBe(0);
      expect(scenarioDistribution.noMatchCount).toBe(1);
    });

    test('should persist HIGH_CONFIDENCE_MATCH to verification collection, not DLQ', async () => {
      const matchCandidates = [
        {
          trusteeId: 't-1',
          trusteeName: 'Trustee 1',
          totalScore: -1,
          addressScore: -1,
          districtDivisionScore: -1,
          chapterScore: -1,
        },
        {
          trusteeId: 't-2',
          trusteeName: 'Trustee 2',
          totalScore: -1,
          addressScore: -1,
          districtDivisionScore: -1,
          chapterScore: -1,
        },
      ];
      const multiMatchError = new CamsError('TRUSTEE-MATCH', {
        message: 'Multiple match',
        data: { mismatchReason: 'MULTIPLE_TRUSTEES_MATCH', matchCandidates },
      });
      (trusteeMatchHelpers.matchTrusteeByName as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        multiMatchError,
      );

      const scoredCandidates = [
        {
          trusteeId: 't-1',
          trusteeName: 'Trustee 1',
          totalScore: 90,
          addressScore: 100,
          districtDivisionScore: 100,
          chapterScore: 100,
        },
        {
          trusteeId: 't-2',
          trusteeName: 'Trustee 2',
          totalScore: 40,
          addressScore: 0,
          districtDivisionScore: 50,
          chapterScore: 0,
        },
      ];
      // Mock fuzzy matching to succeed with a winner
      vi.spyOn(trusteeMatchHelpers, 'resolveTrusteeWithFuzzyMatching').mockResolvedValueOnce({
        winnerId: 't-1',
        candidateScores: scoredCandidates,
      });

      const { successCount, dlqMessages, scenarioDistribution } =
        await SyncTrusteeAppointments.processAppointments(context, [
          makeEvent('case-001', 'Common Name'),
        ]);

      expect(trusteeMatchHelpers.resolveTrusteeWithFuzzyMatching).toHaveBeenCalledWith(
        context,
        makeEvent('case-001', 'Common Name'),
        ['t-1', 't-2'],
      );
      // Fuzzy winner should NOT be auto-linked — saved to verification collection
      expect(mockAppointmentsRepo.createCaseAppointment).not.toHaveBeenCalled();
      expect(successCount).toBe(0);
      expect(dlqMessages).toHaveLength(0);
      expect(mockVerificationRepo.upsertVerification).toHaveBeenCalled();
      expect(scenarioDistribution.highConfidenceMatchCount).toBe(1);
    });

    test('should persist MULTIPLE_TRUSTEES_MATCH to verification collection when fuzzy matching fails, not DLQ', async () => {
      const matchCandidates = [
        {
          trusteeId: 't-1',
          trusteeName: 'Trustee 1',
          totalScore: -1,
          addressScore: -1,
          districtDivisionScore: -1,
          chapterScore: -1,
        },
        {
          trusteeId: 't-2',
          trusteeName: 'Trustee 2',
          totalScore: -1,
          addressScore: -1,
          districtDivisionScore: -1,
          chapterScore: -1,
        },
      ];
      const multiMatchError = new CamsError('TRUSTEE-MATCH', {
        message: 'Multiple match',
        data: { mismatchReason: 'MULTIPLE_TRUSTEES_MATCH', matchCandidates },
      });
      (trusteeMatchHelpers.matchTrusteeByName as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        multiMatchError,
      );

      // Mock fuzzy matching to fail with scores
      const scoredCandidates = [
        {
          trusteeId: 't-1',
          trusteeName: 'John Doe 1',
          totalScore: 60,
          addressScore: 100,
          districtDivisionScore: 50,
          chapterScore: 0,
        },
        {
          trusteeId: 't-2',
          trusteeName: 'John Doe 2',
          totalScore: 58,
          addressScore: 100,
          districtDivisionScore: 45,
          chapterScore: 0,
        },
      ];
      const fuzzyMatchError = new CamsError('TRUSTEE-MATCH', {
        message: 'Fuzzy matching failed',
        data: {
          mismatchReason: 'MULTIPLE_TRUSTEES_MATCH',
          matchCandidates: scoredCandidates,
        },
      });
      vi.spyOn(trusteeMatchHelpers, 'resolveTrusteeWithFuzzyMatching').mockRejectedValueOnce(
        fuzzyMatchError,
      );

      const { dlqMessages, successCount, scenarioDistribution } =
        await SyncTrusteeAppointments.processAppointments(context, [
          makeEvent('case-001', 'Common Name'),
        ]);

      expect(dlqMessages).toHaveLength(0);
      expect(mockVerificationRepo.upsertVerification).toHaveBeenCalled();
      expect(mockAppointmentsRepo.createCaseAppointment).not.toHaveBeenCalled();
      expect(successCount).toBe(0);
      expect(scenarioDistribution.multipleMatchCount).toBe(1);
    });

    test('should persist IMPERFECT_MATCH to verification collection, not DLQ', async () => {
      vi.spyOn(trusteeMatchHelpers, 'isPerfectMatch').mockReturnValue(false);
      vi.spyOn(trusteeMatchHelpers, 'calculateCandidateScore').mockReturnValue({
        trusteeId: 'trustee-123',
        trusteeName: 'John Doe',
        totalScore: 60,
        addressScore: 100,
        districtDivisionScore: 50,
        chapterScore: 0,
      });

      const events = [makeEvent('case-001', 'John Doe')];

      const { successCount, dlqMessages, scenarioDistribution } =
        await SyncTrusteeAppointments.processAppointments(context, events);

      expect(mockAppointmentsRepo.createCaseAppointment).not.toHaveBeenCalled();
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

      const { dlqMessages } = await SyncTrusteeAppointments.processAppointments(context, [
        makeEvent('case-001', 'John Doe'),
      ]);

      expect(dlqMessages).toHaveLength(1);
      expect((dlqMessages[0] as TrusteeAppointmentSyncEvent).error).toBeDefined();
      expect('mismatchReason' in dlqMessages[0]).toBe(false);
    });

    test('scenarioDistribution counts sum to total events processed for mixed batch', async () => {
      // Event 1: perfect match
      (trusteeMatchHelpers.matchTrusteeByName as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce('trustee-1')
        // Event 2: NO_TRUSTEE_MATCH
        .mockRejectedValueOnce(
          new CamsError('TRUSTEE-MATCH', {
            message: 'No match',
            data: { mismatchReason: 'NO_TRUSTEE_MATCH' },
          }),
        )
        // Event 3: imperfect match
        .mockResolvedValueOnce('trustee-3');

      vi.spyOn(trusteeMatchHelpers, 'isPerfectMatch')
        .mockReturnValueOnce(true) // Event 1
        .mockReturnValueOnce(false); // Event 3

      vi.spyOn(trusteeMatchHelpers, 'calculateCandidateScore').mockReturnValue({
        trusteeId: 'trustee-3',
        trusteeName: 'Trustee 3',
        totalScore: 50,
        addressScore: 0,
        districtDivisionScore: 50,
        chapterScore: 0,
      });

      const events = [
        makeEvent('case-001', 'Perfect'),
        makeEvent('case-002', 'NoMatch'),
        makeEvent('case-003', 'Imperfect'),
      ];

      const { scenarioDistribution } = await SyncTrusteeAppointments.processAppointments(
        context,
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

      await SyncTrusteeAppointments.processAppointments(context, events);

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
      vi.spyOn(trusteeMatchHelpers, 'isPerfectMatch').mockReturnValue(false);
      vi.spyOn(trusteeMatchHelpers, 'calculateCandidateScore').mockReturnValue({
        trusteeId: 'trustee-123',
        trusteeName: 'John Doe',
        totalScore: 60,
        addressScore: 100,
        districtDivisionScore: 50,
        chapterScore: 0,
      });
      const infoSpy = vi.spyOn(context.logger, 'info');

      await SyncTrusteeAppointments.processAppointments(context, [
        makeEvent('case-001', 'John Doe'),
      ]);

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

    test('should emit TRUSTEE_MATCH_AUDIT log for HIGH_CONFIDENCE_MATCH event', async () => {
      const matchCandidates = [
        {
          trusteeId: 't-1',
          trusteeName: 'T1',
          totalScore: -1,
          addressScore: -1,
          districtDivisionScore: -1,
          chapterScore: -1,
        },
        {
          trusteeId: 't-2',
          trusteeName: 'T2',
          totalScore: -1,
          addressScore: -1,
          districtDivisionScore: -1,
          chapterScore: -1,
        },
      ];
      (trusteeMatchHelpers.matchTrusteeByName as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new CamsError('TRUSTEE-MATCH', {
          message: 'Multiple match',
          data: { mismatchReason: 'MULTIPLE_TRUSTEES_MATCH', matchCandidates },
        }),
      );
      vi.spyOn(trusteeMatchHelpers, 'resolveTrusteeWithFuzzyMatching').mockResolvedValueOnce({
        winnerId: 't-1',
        candidateScores: [
          {
            trusteeId: 't-1',
            trusteeName: 'T1',
            totalScore: 90,
            addressScore: 100,
            districtDivisionScore: 100,
            chapterScore: 100,
          },
          {
            trusteeId: 't-2',
            trusteeName: 'T2',
            totalScore: 40,
            addressScore: 0,
            districtDivisionScore: 50,
            chapterScore: 0,
          },
        ],
      });
      const infoSpy = vi.spyOn(context.logger, 'info');

      await SyncTrusteeAppointments.processAppointments(context, [
        makeEvent('case-001', 'Common Name'),
      ]);

      const auditCalls = infoSpy.mock.calls.filter((call) => call[1] === 'TRUSTEE_MATCH_AUDIT');
      expect(auditCalls).toHaveLength(1);
      expect(auditCalls[0][2]).toEqual(
        expect.objectContaining({
          matchOutcome: 'high-confidence',
          matchedTrusteeId: 't-1',
          scoringBreakdown: { districtDivisionScore: 100, chapterScore: 100 },
        }),
      );
    });

    test('should emit TRUSTEE_MATCH_AUDIT log for NO_TRUSTEE_MATCH event', async () => {
      (trusteeMatchHelpers.matchTrusteeByName as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new CamsError('TRUSTEE-MATCH', {
          message: 'No match',
          data: { mismatchReason: 'NO_TRUSTEE_MATCH' },
        }),
      );
      const infoSpy = vi.spyOn(context.logger, 'info');

      await SyncTrusteeAppointments.processAppointments(context, [makeEvent('case-001', 'Ghost')]);

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

      await SyncTrusteeAppointments.processAppointments(context, events);

      const auditCalls = infoSpy.mock.calls.filter((call) => call[1] === 'TRUSTEE_MATCH_AUDIT');
      expect(auditCalls).toHaveLength(3);
    });

    describe('TrusteeMatchVerification persistence', () => {
      test('upserts verification doc for IMPERFECT_MATCH outcome', async () => {
        vi.spyOn(trusteeMatchHelpers, 'isPerfectMatch').mockReturnValue(false);
        vi.spyOn(trusteeMatchHelpers, 'calculateCandidateScore').mockReturnValue({
          trusteeId: 'trustee-123',
          trusteeName: 'John Doe',
          totalScore: 60,
          addressScore: 100,
          districtDivisionScore: 50,
          chapterScore: 0,
        });

        await SyncTrusteeAppointments.processAppointments(context, [
          makeEvent('case-001', 'John Doe'),
        ]);

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

      test('upserts verification doc for HIGH_CONFIDENCE_MATCH outcome', async () => {
        const matchCandidates = [
          {
            trusteeId: 't-1',
            trusteeName: 'T1',
            totalScore: -1,
            addressScore: -1,
            districtDivisionScore: -1,
            chapterScore: -1,
          },
          {
            trusteeId: 't-2',
            trusteeName: 'T2',
            totalScore: -1,
            addressScore: -1,
            districtDivisionScore: -1,
            chapterScore: -1,
          },
        ];
        (trusteeMatchHelpers.matchTrusteeByName as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
          new CamsError('TRUSTEE-MATCH', {
            message: 'Multiple match',
            data: { mismatchReason: 'MULTIPLE_TRUSTEES_MATCH', matchCandidates },
          }),
        );
        const scoredCandidates = [
          {
            trusteeId: 't-1',
            trusteeName: 'T1',
            totalScore: 90,
            addressScore: 100,
            districtDivisionScore: 100,
            chapterScore: 100,
          },
          {
            trusteeId: 't-2',
            trusteeName: 'T2',
            totalScore: 40,
            addressScore: 0,
            districtDivisionScore: 50,
            chapterScore: 0,
          },
        ];
        vi.spyOn(trusteeMatchHelpers, 'resolveTrusteeWithFuzzyMatching').mockResolvedValueOnce({
          winnerId: 't-1',
          candidateScores: scoredCandidates,
        });

        await SyncTrusteeAppointments.processAppointments(context, [
          makeEvent('case-001', 'Common Name'),
        ]);

        expect(mockVerificationRepo.upsertVerification).toHaveBeenCalledWith(
          expect.objectContaining({
            documentType: 'TRUSTEE_MATCH_VERIFICATION',
            caseId: 'case-001',
            mismatchReason: 'HIGH_CONFIDENCE_MATCH',
            matchCandidates: scoredCandidates,
            status: 'pending',
          }),
        );
      });

      test('upserts verification doc for MULTIPLE_TRUSTEES_MATCH outcome', async () => {
        const matchCandidates = [
          {
            trusteeId: 't-1',
            trusteeName: 'T1',
            totalScore: -1,
            addressScore: -1,
            districtDivisionScore: -1,
            chapterScore: -1,
          },
          {
            trusteeId: 't-2',
            trusteeName: 'T2',
            totalScore: -1,
            addressScore: -1,
            districtDivisionScore: -1,
            chapterScore: -1,
          },
        ];
        (trusteeMatchHelpers.matchTrusteeByName as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
          new CamsError('TRUSTEE-MATCH', {
            message: 'Multiple match',
            data: { mismatchReason: 'MULTIPLE_TRUSTEES_MATCH', matchCandidates },
          }),
        );
        vi.spyOn(trusteeMatchHelpers, 'resolveTrusteeWithFuzzyMatching').mockRejectedValueOnce(
          new CamsError('TRUSTEE-MATCH', {
            message: 'Fuzzy failed',
            data: { mismatchReason: 'MULTIPLE_TRUSTEES_MATCH', matchCandidates: [] },
          }),
        );

        await SyncTrusteeAppointments.processAppointments(context, [
          makeEvent('case-001', 'Common Name'),
        ]);

        expect(mockVerificationRepo.upsertVerification).toHaveBeenCalledWith(
          expect.objectContaining({
            documentType: 'TRUSTEE_MATCH_VERIFICATION',
            caseId: 'case-001',
            mismatchReason: 'MULTIPLE_TRUSTEES_MATCH',
            status: 'pending',
          }),
        );
      });

      test('upserts verification doc for NO_TRUSTEE_MATCH outcome', async () => {
        (trusteeMatchHelpers.matchTrusteeByName as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
          new CamsError('TRUSTEE-MATCH', {
            message: 'No match',
            data: { mismatchReason: 'NO_TRUSTEE_MATCH' },
          }),
        );

        await SyncTrusteeAppointments.processAppointments(context, [
          makeEvent('case-001', 'Ghost Trustee'),
        ]);

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

      test('does NOT upsert for auto-matched outcome', async () => {
        await SyncTrusteeAppointments.processAppointments(context, [
          makeEvent('case-001', 'John Doe'),
        ]);

        expect(mockVerificationRepo.upsertVerification).not.toHaveBeenCalled();
      });

      test('skips upsert when existing doc is resolved', async () => {
        (mockVerificationRepo.getVerification as ReturnType<typeof vi.fn>).mockResolvedValue({
          documentType: 'TRUSTEE_MATCH_VERIFICATION',
          caseId: 'case-001',
          status: 'approved',
          createdOn: '2025-01-01T00:00:00.000Z',
          updatedOn: '2025-01-01T00:00:00.000Z',
          updatedBy: { id: 'user-1', name: 'Operator' },
        });
        vi.spyOn(trusteeMatchHelpers, 'isPerfectMatch').mockReturnValue(false);
        vi.spyOn(trusteeMatchHelpers, 'calculateCandidateScore').mockReturnValue({
          trusteeId: 'trustee-123',
          trusteeName: 'John Doe',
          totalScore: 60,
          addressScore: 100,
          districtDivisionScore: 50,
          chapterScore: 0,
        });

        await SyncTrusteeAppointments.processAppointments(context, [
          makeEvent('case-001', 'John Doe'),
        ]);

        expect(mockVerificationRepo.upsertVerification).not.toHaveBeenCalled();
      });

      test('skips upsert when existing doc is dismissed', async () => {
        (mockVerificationRepo.getVerification as ReturnType<typeof vi.fn>).mockResolvedValue({
          documentType: 'TRUSTEE_MATCH_VERIFICATION',
          caseId: 'case-001',
          status: 'rejected',
          createdOn: '2025-01-01T00:00:00.000Z',
          updatedOn: '2025-01-01T00:00:00.000Z',
          updatedBy: { id: 'user-1', name: 'Operator' },
        });
        (trusteeMatchHelpers.matchTrusteeByName as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
          new CamsError('TRUSTEE-MATCH', {
            message: 'No match',
            data: { mismatchReason: 'NO_TRUSTEE_MATCH' },
          }),
        );

        await SyncTrusteeAppointments.processAppointments(context, [
          makeEvent('case-001', 'Ghost'),
        ]);

        expect(mockVerificationRepo.upsertVerification).not.toHaveBeenCalled();
      });

      test('preserves createdOn and sets updatedOn when overwriting existing pending doc', async () => {
        const existingCreatedOn = '2025-01-01T00:00:00.000Z';
        (mockVerificationRepo.getVerification as ReturnType<typeof vi.fn>).mockResolvedValue({
          documentType: 'TRUSTEE_MATCH_VERIFICATION',
          caseId: 'case-001',
          status: 'pending',
          createdOn: existingCreatedOn,
          updatedOn: existingCreatedOn,
          updatedBy: { id: 'SYSTEM', name: 'SYSTEM' },
        });
        (trusteeMatchHelpers.matchTrusteeByName as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
          new CamsError('TRUSTEE-MATCH', {
            message: 'No match',
            data: { mismatchReason: 'NO_TRUSTEE_MATCH' },
          }),
        );

        await SyncTrusteeAppointments.processAppointments(context, [
          makeEvent('case-001', 'Ghost'),
        ]);

        expect(mockVerificationRepo.upsertVerification).toHaveBeenCalledWith(
          expect.objectContaining({
            createdOn: existingCreatedOn,
            updatedOn: expect.any(String),
          }),
        );
        const callArg = (mockVerificationRepo.upsertVerification as ReturnType<typeof vi.fn>).mock
          .calls[0][0];
        expect(callArg.updatedOn).not.toBe(existingCreatedOn);
      });

      test('sets createdOn and omits updatedBy as SYSTEM for first-time insert', async () => {
        (trusteeMatchHelpers.matchTrusteeByName as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
          new CamsError('TRUSTEE-MATCH', {
            message: 'No match',
            data: { mismatchReason: 'NO_TRUSTEE_MATCH' },
          }),
        );

        await SyncTrusteeAppointments.processAppointments(context, [
          makeEvent('case-001', 'Ghost'),
        ]);

        expect(mockVerificationRepo.upsertVerification).toHaveBeenCalledWith(
          expect.objectContaining({
            createdOn: expect.any(String),
            updatedBy: { id: 'SYSTEM', name: 'SYSTEM' },
          }),
        );
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
        vi.spyOn(trusteeMatchHelpers, 'isPerfectMatch').mockReturnValue(false);
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
          await SyncTrusteeAppointments.processAppointments(context, [
            makeEvent('case-001', 'John Doe'),
          ]);

        expect(mockAppointmentsRepo.createCaseAppointment).not.toHaveBeenCalled();
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
                totalScore: 100,
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

        await SyncTrusteeAppointments.processAppointments(context, [
          makeEvent('case-001', 'John Doe'),
        ]);

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

      test('should fall through to IMPERFECT_MATCH when findInactivePerfectMatch returns undefined', async () => {
        vi.spyOn(trusteeMatchHelpers, 'findInactivePerfectMatch').mockReturnValue(undefined);
        vi.spyOn(trusteeMatchHelpers, 'calculateCandidateScore').mockReturnValue({
          trusteeId: 'trustee-123',
          trusteeName: 'John Doe',
          totalScore: 60,
          addressScore: 100,
          districtDivisionScore: 50,
          chapterScore: 0,
        });

        const { scenarioDistribution } = await SyncTrusteeAppointments.processAppointments(
          context,
          [makeEvent('case-001', 'John Doe')],
        );

        expect(scenarioDistribution.imperfectMatchCount).toBe(1);
        expect(scenarioDistribution.perfectMatchInactiveCount).toBe(0);
      });

      test('should include perfectMatchInactiveCount in scenarioDistribution for mixed batch', async () => {
        // Event 1: perfect match (auto-link)
        (trusteeMatchHelpers.matchTrusteeByName as ReturnType<typeof vi.fn>)
          .mockResolvedValueOnce('trustee-1')
          // Event 2: inactive perfect match
          .mockResolvedValueOnce('trustee-2')
          // Event 3: no match
          .mockRejectedValueOnce(
            new CamsError('TRUSTEE-MATCH', {
              message: 'No match',
              data: { mismatchReason: 'NO_TRUSTEE_MATCH' },
            }),
          );

        vi.spyOn(trusteeMatchHelpers, 'isPerfectMatch')
          .mockReturnValueOnce(true) // Event 1
          .mockReturnValueOnce(false); // Event 2

        // Event 1 takes the isPerfectMatch=true branch, so findInactivePerfectMatch is not called.
        // Only Event 2 calls it.
        vi.spyOn(trusteeMatchHelpers, 'findInactivePerfectMatch').mockReturnValueOnce(
          inactiveAppointment,
        );

        const { scenarioDistribution } = await SyncTrusteeAppointments.processAppointments(
          context,
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
        (mockVerificationRepo.getVerification as ReturnType<typeof vi.fn>).mockResolvedValue({
          documentType: 'TRUSTEE_MATCH_VERIFICATION',
          caseId: 'case-001',
          status: 'approved',
          createdOn: '2025-01-01T00:00:00.000Z',
          updatedOn: '2025-01-01T00:00:00.000Z',
          updatedBy: { id: 'user-1', name: 'Operator' },
        });

        const { scenarioDistribution } = await SyncTrusteeAppointments.processAppointments(
          context,
          [makeEvent('case-001', 'John Doe')],
        );

        expect(mockVerificationRepo.upsertVerification).not.toHaveBeenCalled();
        expect(scenarioDistribution.reVerificationCount).toBe(1);
        expect(scenarioDistribution.perfectMatchInactiveCount).toBe(1);
      });
    });
  });

  describe('getAppointmentEvents', () => {
    let context: ApplicationContext;
    let mockRuntimeStateRepo: Partial<RuntimeStateRepository<TrusteeAppointmentsSyncState>>;
    let mockCasesGateway: Partial<CasesInterface>;

    const mockEvents: TrusteeAppointmentSyncEvent[] = [
      { caseId: 'case-001', courtId: '081', dxtrTrustee: { fullName: 'Jane Doe' } },
    ];
    const mockLatestSyncDate = '2025-01-15T00:00:00Z';

    beforeEach(async () => {
      context = await createMockApplicationContext();

      mockRuntimeStateRepo = {
        read: vi.fn().mockResolvedValue({
          id: 'state-1',
          documentType: 'TRUSTEE_APPOINTMENTS_SYNC_STATE',
          lastSyncDate: '2025-01-01T00:00:00Z',
        }),
      };

      mockCasesGateway = {
        getTrusteeAppointments: vi
          .fn()
          .mockResolvedValue({ events: mockEvents, latestSyncDate: mockLatestSyncDate }),
      };

      vi.spyOn(factory, 'getTrusteeAppointmentsSyncStateRepo').mockReturnValue(
        mockRuntimeStateRepo as RuntimeStateRepository<TrusteeAppointmentsSyncState>,
      );
      vi.spyOn(factory, 'getCasesGateway').mockReturnValue(mockCasesGateway as CasesInterface);
    });

    afterEach(async () => {
      await closeDeferred(context);
      vi.restoreAllMocks();
    });

    test('should use provided lastSyncDate without reading from repo', async () => {
      const { events, latestSyncDate } = await SyncTrusteeAppointments.getAppointmentEvents(
        context,
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
      const { events, latestSyncDate } =
        await SyncTrusteeAppointments.getAppointmentEvents(context);

      expect(mockRuntimeStateRepo.read).toHaveBeenCalledWith('TRUSTEE_APPOINTMENTS_SYNC_STATE');
      expect(mockCasesGateway.getTrusteeAppointments).toHaveBeenCalledWith(
        context,
        '2025-01-01T00:00:00Z',
      );
      expect(events).toEqual(mockEvents);
      expect(latestSyncDate).toBe(mockLatestSyncDate);
    });

    test('should throw and log when cases gateway fails', async () => {
      vi.spyOn(factory, 'getCasesGateway').mockReturnValue({
        getTrusteeAppointments: vi.fn().mockRejectedValue(new Error('DXTR unavailable')),
      } as unknown as CasesInterface);

      await expect(
        SyncTrusteeAppointments.getAppointmentEvents(context, '2025-01-01T00:00:00Z'),
      ).rejects.toThrow();
    });
  });

  describe('storeRuntimeState', () => {
    let context: ApplicationContext;
    let mockRuntimeStateRepo: Partial<RuntimeStateRepository<TrusteeAppointmentsSyncState>>;

    beforeEach(async () => {
      context = await createMockApplicationContext();

      mockRuntimeStateRepo = {
        upsert: vi.fn().mockResolvedValue(undefined),
      };

      vi.spyOn(factory, 'getTrusteeAppointmentsSyncStateRepo').mockReturnValue(
        mockRuntimeStateRepo as RuntimeStateRepository<TrusteeAppointmentsSyncState>,
      );
    });

    afterEach(async () => {
      await closeDeferred(context);
      vi.restoreAllMocks();
    });

    test('should upsert the runtime state with the given lastSyncDate', async () => {
      await SyncTrusteeAppointments.storeRuntimeState(context, '2025-02-01T00:00:00Z');

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

      await expect(
        SyncTrusteeAppointments.storeRuntimeState(context, '2025-02-01T00:00:00Z'),
      ).resolves.toBeUndefined();
    });
  });
});
