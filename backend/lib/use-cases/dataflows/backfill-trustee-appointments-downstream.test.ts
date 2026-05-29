import { describe, test, expect, vi, beforeEach } from 'vitest';
import { ApplicationContext } from '../../adapters/types/basic';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import BackfillTrusteeAppointmentsDownstream from './backfill-trustee-appointments-downstream';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import { NotFoundError } from '../../common-errors/not-found-error';
import { TrusteeAppointmentsDownstreamBackfillState } from '../gateways.types';
import MockData from '@common/cams/test-utilities/mock-data';
import { CaseAppointment } from '@common/cams/trustee-appointments';
import { MOCKED_USTP_OFFICES_ARRAY } from '@common/cams/test-utilities/offices.mock';
import factory from '../../factory';
import { ApiToDataflowsGateway, TrusteeAppointmentsRepository } from '../gateways.types';

const makeAppointment = (
  overrides: Partial<CaseAppointment & { _id: string }> = {},
): CaseAppointment & { _id: string } => ({
  _id: 'mongo-id-1',
  id: 'appt-1',
  caseId: '081-24-00001',
  trusteeId: 'trustee-1',
  assignedOn: '2024-01-01T00:00:00.000Z',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  createdBy: { id: 'system', name: 'system', address: 'system' },
  updatedBy: { id: 'system', name: 'system', address: 'system' },
  ...overrides,
});

describe('BackfillTrusteeAppointmentsDownstream use case', () => {
  let context: ApplicationContext;

  beforeEach(async () => {
    context = await createMockApplicationContext();
  });

  describe('getPageOfAppointments', () => {
    test('should return hasMore=true when repo returns more than limit', async () => {
      const appt1 = makeAppointment({ _id: 'mongo-id-1', caseId: '081-24-00001' });
      const appt2 = makeAppointment({ _id: 'mongo-id-2', id: 'appt-2', caseId: '081-24-00002' });

      vi.spyOn(MockMongoRepository.prototype, 'getAllCaseAppointments').mockResolvedValue([
        appt1,
        appt2,
      ]);

      const result = await BackfillTrusteeAppointmentsDownstream.getPageOfAppointments(
        context,
        null,
        1,
      );

      expect(result.error).toBeUndefined();
      expect(result.data).toBeDefined();
      expect(result.data?.appointments.length).toBe(1);
      expect(result.data?.hasMore).toBe(true);
      expect(result.data?.lastId).toBe('mongo-id-1');
    });

    test('should return hasMore=false when repo returns fewer than limit+1 items', async () => {
      const appt1 = makeAppointment({ _id: 'mongo-id-1' });

      vi.spyOn(MockMongoRepository.prototype, 'getAllCaseAppointments').mockResolvedValue([appt1]);

      const result = await BackfillTrusteeAppointmentsDownstream.getPageOfAppointments(
        context,
        null,
        10,
      );

      expect(result.error).toBeUndefined();
      expect(result.data).toBeDefined();
      expect(result.data?.appointments.length).toBe(1);
      expect(result.data?.hasMore).toBe(false);
      expect(result.data?.lastId).toBe('mongo-id-1');
    });

    test('should propagate errors from the repository', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'getAllCaseAppointments').mockRejectedValue(
        new Error('Database error'),
      );

      const result = await BackfillTrusteeAppointmentsDownstream.getPageOfAppointments(
        context,
        null,
        100,
      );

      expect(result.error).toBeDefined();
      expect(result.data).toBeUndefined();
    });
  });

  describe('processAppointmentsPage', () => {
    let mockAppointmentsRepo: Partial<TrusteeAppointmentsRepository>;
    let mockApiToDataflows: Partial<ApiToDataflowsGateway>;

    beforeEach(() => {
      mockAppointmentsRepo = {
        upsertDownstreamSyncError: vi.fn().mockResolvedValue(undefined),
      };
      mockApiToDataflows = {
        queueTrusteeAppointmentEvent: vi.fn().mockResolvedValue(undefined),
      };

      vi.spyOn(factory, 'getTrusteeAppointmentsRepository').mockReturnValue(
        mockAppointmentsRepo as TrusteeAppointmentsRepository,
      );
      vi.spyOn(factory, 'getOfficesGateway').mockReturnValue({
        getOffices: vi.fn().mockResolvedValue(MOCKED_USTP_OFFICES_ARRAY),
        getOfficeName: vi.fn(),
      });
      vi.spyOn(factory, 'getTrusteeProfessionalIdsRepository').mockReturnValue({
        findByCamsTrusteeId: vi.fn().mockResolvedValue([{ acmsProfessionalId: 'NY-12345' }]),
        release: vi.fn(),
      } as never);
      vi.spyOn(factory, 'getApiToDataflowsGateway').mockReturnValue(
        mockApiToDataflows as ApiToDataflowsGateway,
      );
    });

    test('should queue events for appointments with resolved professional IDs', async () => {
      const syncedCase = MockData.getSyncedCase({
        override: { caseId: '081-24-00001', courtDivisionCode: '081', chapter: '7' },
      });
      vi.spyOn(MockMongoRepository.prototype, 'getSyncedCase').mockResolvedValue(syncedCase);

      const appointment = makeAppointment({ caseId: '081-24-00001', trusteeId: 'trustee-1' });

      const result = await BackfillTrusteeAppointmentsDownstream.processAppointmentsPage(context, [
        appointment,
      ]);

      expect(result.error).toBeUndefined();
      expect(result.data).toBeDefined();
      expect(result.data?.successCount).toBe(1);
      expect(mockApiToDataflows.queueTrusteeAppointmentEvent).toHaveBeenCalledTimes(1);
    });

    test('should skip and write sync error doc when professional ID cannot be resolved', async () => {
      const syncedCase = MockData.getSyncedCase({
        override: { caseId: '081-24-00001', courtDivisionCode: '081', chapter: '7' },
      });
      vi.spyOn(MockMongoRepository.prototype, 'getSyncedCase').mockResolvedValue(syncedCase);

      // Override professional IDs to have a mismatched group prefix
      vi.spyOn(factory, 'getTrusteeProfessionalIdsRepository').mockReturnValue({
        findByCamsTrusteeId: vi.fn().mockResolvedValue([{ acmsProfessionalId: 'CA-99999' }]),
        release: vi.fn(),
      } as never);

      const appointment = makeAppointment({ caseId: '081-24-00001', trusteeId: 'trustee-1' });

      const result = await BackfillTrusteeAppointmentsDownstream.processAppointmentsPage(context, [
        appointment,
      ]);

      expect(result.error).toBeUndefined();
      expect(result.data).toBeDefined();
      expect(result.data?.successCount).toBe(0);
      expect(mockAppointmentsRepo.upsertDownstreamSyncError).toHaveBeenCalledTimes(1);
      expect(mockApiToDataflows.queueTrusteeAppointmentEvent).not.toHaveBeenCalled();
    });

    test('should include unassignedOn in event for closed appointments', async () => {
      const syncedCase = MockData.getSyncedCase({
        override: { caseId: '081-24-00001', courtDivisionCode: '081', chapter: '7' },
      });
      vi.spyOn(MockMongoRepository.prototype, 'getSyncedCase').mockResolvedValue(syncedCase);

      const appointment = makeAppointment({
        caseId: '081-24-00001',
        trusteeId: 'trustee-1',
        unassignedOn: '2024-06-01T00:00:00.000Z',
      });

      const result = await BackfillTrusteeAppointmentsDownstream.processAppointmentsPage(context, [
        appointment,
      ]);

      expect(result.error).toBeUndefined();
      expect(result.data?.successCount).toBe(1);
      expect(mockApiToDataflows.queueTrusteeAppointmentEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          unassignedOn: '2024-06-01T00:00:00.000Z',
        }),
      );
    });

    test('should continue processing and record error when getSyncedCase fails', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'getSyncedCase').mockRejectedValue(
        new Error('Case not found'),
      );

      const appointment = makeAppointment({ caseId: '081-24-00001' });

      const result = await BackfillTrusteeAppointmentsDownstream.processAppointmentsPage(context, [
        appointment,
      ]);

      expect(result.error).toBeUndefined();
      expect(result.data).toBeDefined();
      expect(result.data?.successCount).toBe(0);
      expect(result.data?.errors.length).toBe(1);
      expect(mockApiToDataflows.queueTrusteeAppointmentEvent).not.toHaveBeenCalled();
      expect(mockAppointmentsRepo.upsertDownstreamSyncError).toHaveBeenCalledTimes(1);
    });

    test('should swallow upsertDownstreamSyncError failure and still record appointment as an error', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'getSyncedCase').mockRejectedValue(
        new Error('Case not found'),
      );
      (
        mockAppointmentsRepo.upsertDownstreamSyncError as ReturnType<typeof vi.fn>
      ).mockRejectedValue(new Error('Sync error write failed'));

      const appointment = makeAppointment({ caseId: '081-24-00001' });

      const result = await BackfillTrusteeAppointmentsDownstream.processAppointmentsPage(context, [
        appointment,
      ]);

      expect(result.error).toBeUndefined();
      expect(result.data).toBeDefined();
      expect(result.data?.errors.length).toBe(1);
      expect(mockApiToDataflows.queueTrusteeAppointmentEvent).not.toHaveBeenCalled();
    });
  });

  describe('readBackfillState', () => {
    test('should return null when no state exists (NotFoundError)', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'read').mockRejectedValue(
        new NotFoundError('TEST', { message: 'Not found' }),
      );

      const result = await BackfillTrusteeAppointmentsDownstream.readBackfillState(context);

      expect(result.error).toBeUndefined();
      expect(result.data).toBeNull();
    });

    test('should return existing state', async () => {
      const existingState: TrusteeAppointmentsDownstreamBackfillState = {
        id: 'state-id-1',
        documentType: 'TRUSTEE_APPOINTMENTS_DOWNSTREAM_BACKFILL_STATE',
        lastId: 'cursor-abc',
        processedCount: 250,
        startedAt: '2024-01-01T00:00:00.000Z',
        lastUpdatedAt: '2024-01-01T01:00:00.000Z',
        status: 'IN_PROGRESS',
      };

      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(existingState);

      const result = await BackfillTrusteeAppointmentsDownstream.readBackfillState(context);

      expect(result.error).toBeUndefined();
      expect(result.data).toBeDefined();
      expect(result.data?.lastId).toBe('cursor-abc');
      expect(result.data?.processedCount).toBe(250);
      expect(result.data?.status).toBe('IN_PROGRESS');
    });

    test('should return error on unexpected failure', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'read').mockRejectedValue(
        new Error('Database connection failed'),
      );

      const result = await BackfillTrusteeAppointmentsDownstream.readBackfillState(context);

      expect(result.error).toBeDefined();
      expect(result.data).toBeUndefined();
    });
  });

  describe('updateBackfillState', () => {
    test('should upsert state correctly when no prior state exists', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'read').mockRejectedValue(
        new NotFoundError('TEST', { message: 'Not found' }),
      );

      const upsertSpy = vi.spyOn(MockMongoRepository.prototype, 'upsert').mockResolvedValue({
        id: 'new-state-id',
        documentType: 'TRUSTEE_APPOINTMENTS_DOWNSTREAM_BACKFILL_STATE',
        lastId: 'cursor-abc',
        processedCount: 100,
        startedAt: '2024-01-01T00:00:00.000Z',
        lastUpdatedAt: '2024-01-01T00:00:00.000Z',
        status: 'IN_PROGRESS',
      } as TrusteeAppointmentsDownstreamBackfillState);

      const result = await BackfillTrusteeAppointmentsDownstream.updateBackfillState(context, {
        lastId: 'cursor-abc',
        processedCount: 100,
        status: 'IN_PROGRESS',
      });

      expect(result.error).toBeUndefined();
      expect(result.data).toBeDefined();
      expect(upsertSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          documentType: 'TRUSTEE_APPOINTMENTS_DOWNSTREAM_BACKFILL_STATE',
          lastId: 'cursor-abc',
          processedCount: 100,
          status: 'IN_PROGRESS',
        }),
      );
    });

    test('should preserve startedAt when updating existing state', async () => {
      const existingState: TrusteeAppointmentsDownstreamBackfillState = {
        id: 'existing-id',
        documentType: 'TRUSTEE_APPOINTMENTS_DOWNSTREAM_BACKFILL_STATE',
        lastId: 'old-cursor',
        processedCount: 50,
        startedAt: '2024-01-01T00:00:00.000Z',
        lastUpdatedAt: '2024-01-01T00:30:00.000Z',
        status: 'IN_PROGRESS',
      };

      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(existingState);

      const upsertSpy = vi.spyOn(MockMongoRepository.prototype, 'upsert').mockResolvedValue({
        ...existingState,
        lastId: 'new-cursor',
        processedCount: 150,
      } as TrusteeAppointmentsDownstreamBackfillState);

      const result = await BackfillTrusteeAppointmentsDownstream.updateBackfillState(context, {
        lastId: 'new-cursor',
        processedCount: 150,
        status: 'IN_PROGRESS',
      });

      expect(result.error).toBeUndefined();
      expect(upsertSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'existing-id',
          startedAt: '2024-01-01T00:00:00.000Z',
          lastId: 'new-cursor',
          processedCount: 150,
        }),
      );
    });
  });
});
