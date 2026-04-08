import { describe, test, expect, vi, beforeAll, afterEach } from 'vitest';
import { ApplicationContext } from '../../adapters/types/basic';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import BackfillCaseAppointmentDatesUseCase from './backfill-case-appointment-dates';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import { CasesLocalGateway } from '../../adapters/gateways/cases.local.gateway';
import { NotFoundError } from '../../common-errors/not-found-error';
import { CaseAppointmentDateBackfillState } from '../gateways.types';
import { CaseAppointment } from '@common/cams/trustee-appointments';

function makeCaseAppointment(override: Partial<CaseAppointment> = {}): CaseAppointment {
  return {
    id: 'appt-id-1',
    caseId: '081-25-12345',
    trusteeId: 'trustee-001',
    assignedOn: '2025-01-01T00:00:00.000Z',
    createdOn: '2025-01-01T00:00:00.000Z',
    createdBy: { id: 'user-1', name: 'Test User' },
    updatedOn: '2025-01-01T00:00:00.000Z',
    updatedBy: { id: 'user-1', name: 'Test User' },
    ...override,
  };
}

describe('BackfillCaseAppointmentDatesUseCase', () => {
  let context: ApplicationContext;

  beforeAll(async () => {
    context = await createMockApplicationContext();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getPageNeedingBackfill', () => {
    test('should return a page of appointments needing backfill', async () => {
      const mockAppointment = {
        ...makeCaseAppointment(),
        _id: 'appt-id-1',
        appointedDate: undefined,
      };

      vi.spyOn(MockMongoRepository.prototype, 'findByCursor').mockResolvedValue([mockAppointment]);

      const result = await BackfillCaseAppointmentDatesUseCase.getPageNeedingBackfill(
        context,
        null,
        100,
      );

      expect(result.error).toBeUndefined();
      expect(result.data).toBeDefined();
      expect(result.data?.appointments.length).toBe(1);
      expect(result.data?.appointments[0]._id).toBe('appt-id-1');
      expect(result.data?.hasMore).toBe(false);
      expect(result.data?.lastId).toBe('appt-id-1');
    });

    test('should detect hasMore when results exceed limit', async () => {
      const appt1 = { ...makeCaseAppointment(), _id: 'appt-id-1' };
      const appt2 = { ...makeCaseAppointment(), _id: 'appt-id-2' };

      vi.spyOn(MockMongoRepository.prototype, 'findByCursor').mockResolvedValue([appt1, appt2]);

      const result = await BackfillCaseAppointmentDatesUseCase.getPageNeedingBackfill(
        context,
        null,
        1,
      );

      expect(result.data?.appointments.length).toBe(1);
      expect(result.data?.hasMore).toBe(true);
      expect(result.data?.lastId).toBe('appt-id-1');
    });

    test('should return empty result when no appointments found', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'findByCursor').mockResolvedValue([]);

      const result = await BackfillCaseAppointmentDatesUseCase.getPageNeedingBackfill(
        context,
        'some-cursor',
        100,
      );

      expect(result.error).toBeUndefined();
      expect(result.data?.appointments.length).toBe(0);
      expect(result.data?.hasMore).toBe(false);
      expect(result.data?.lastId).toBeNull();
    });

    test('should return error when findByCursor fails', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'findByCursor').mockRejectedValue(
        new Error('Database error'),
      );

      const result = await BackfillCaseAppointmentDatesUseCase.getPageNeedingBackfill(
        context,
        null,
        100,
      );

      expect(result.error).toBeDefined();
      expect(result.data).toBeUndefined();
    });
  });

  describe('backfillAppointmentDates', () => {
    test('should write appointedDate for appointments found in DXTR', async () => {
      const appointment = makeCaseAppointment();
      const dxtrMap = new Map([[appointment.caseId, '2026-04-07']]);

      vi.spyOn(CasesLocalGateway.prototype, 'getAppointmentDatesByCaseIds').mockResolvedValue(
        dxtrMap,
      );
      vi.spyOn(MockMongoRepository.prototype, 'getActiveCaseAppointment').mockResolvedValue(
        appointment,
      );
      const updateSpy = vi
        .spyOn(MockMongoRepository.prototype, 'updateCaseAppointment')
        .mockResolvedValue({ ...appointment, appointedDate: '2026-04-07' } as CaseAppointment);

      const result = await BackfillCaseAppointmentDatesUseCase.backfillAppointmentDates(context, [
        { _id: 'appt-id-1', caseId: appointment.caseId, trusteeId: appointment.trusteeId },
      ]);

      expect(result.error).toBeUndefined();
      expect(result.data?.length).toBe(1);
      expect(result.data?.[0].success).toBe(true);
      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ appointedDate: '2026-04-07' }),
      );
    });

    test('should skip and log when DXTR has no date for a case', async () => {
      const appointment = makeCaseAppointment();
      const dxtrMap = new Map<string, string>(); // empty — no date

      vi.spyOn(CasesLocalGateway.prototype, 'getAppointmentDatesByCaseIds').mockResolvedValue(
        dxtrMap,
      );
      const updateSpy = vi.spyOn(MockMongoRepository.prototype, 'updateCaseAppointment');

      const result = await BackfillCaseAppointmentDatesUseCase.backfillAppointmentDates(context, [
        { _id: 'appt-id-1', caseId: appointment.caseId, trusteeId: appointment.trusteeId },
      ]);

      expect(result.error).toBeUndefined();
      expect(result.data?.[0].success).toBe(true);
      expect(updateSpy).not.toHaveBeenCalled();
    });

    test('should record failure when updateCaseAppointment throws', async () => {
      const appointment = makeCaseAppointment();
      const dxtrMap = new Map([[appointment.caseId, '2026-04-07']]);

      vi.spyOn(CasesLocalGateway.prototype, 'getAppointmentDatesByCaseIds').mockResolvedValue(
        dxtrMap,
      );
      vi.spyOn(MockMongoRepository.prototype, 'getActiveCaseAppointment').mockResolvedValue(
        appointment,
      );
      vi.spyOn(MockMongoRepository.prototype, 'updateCaseAppointment').mockRejectedValue(
        new Error('Write failed'),
      );

      const result = await BackfillCaseAppointmentDatesUseCase.backfillAppointmentDates(context, [
        { _id: 'appt-id-1', caseId: appointment.caseId, trusteeId: appointment.trusteeId },
      ]);

      expect(result.data?.[0].success).toBe(false);
      expect(result.data?.[0].error).toBe('Write failed');
    });
  });

  describe('readBackfillState', () => {
    test('should return existing state', async () => {
      const existingState: CaseAppointmentDateBackfillState = {
        id: 'state-id-1',
        documentType: 'CASE_APPOINTMENT_DATE_BACKFILL_STATE',
        lastId: 'cursor-abc',
        processedCount: 42,
        startedAt: '2026-01-01T00:00:00.000Z',
        lastUpdatedAt: '2026-01-01T01:00:00.000Z',
        status: 'IN_PROGRESS',
      };

      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(existingState);

      const result = await BackfillCaseAppointmentDatesUseCase.readBackfillState(context);

      expect(result.error).toBeUndefined();
      expect(result.data?.lastId).toBe('cursor-abc');
      expect(result.data?.processedCount).toBe(42);
    });

    test('should return null on first run (NotFoundError)', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'read').mockRejectedValue(
        new NotFoundError('TEST', { message: 'Not found' }),
      );

      const result = await BackfillCaseAppointmentDatesUseCase.readBackfillState(context);

      expect(result.error).toBeUndefined();
      expect(result.data).toBeNull();
    });

    test('should return error on unexpected failure', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'read').mockRejectedValue(
        new Error('Connection lost'),
      );

      const result = await BackfillCaseAppointmentDatesUseCase.readBackfillState(context);

      expect(result.error).toBeDefined();
    });
  });

  describe('updateBackfillState', () => {
    test('should create new state on first run', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'read').mockRejectedValue(
        new NotFoundError('TEST', { message: 'Not found' }),
      );
      const upsertSpy = vi
        .spyOn(MockMongoRepository.prototype, 'upsert')
        .mockResolvedValue({} as CaseAppointmentDateBackfillState);

      await BackfillCaseAppointmentDatesUseCase.updateBackfillState(context, {
        lastId: 'cursor-xyz',
        processedCount: 10,
        status: 'IN_PROGRESS',
      });

      expect(upsertSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          documentType: 'CASE_APPOINTMENT_DATE_BACKFILL_STATE',
          lastId: 'cursor-xyz',
          processedCount: 10,
          status: 'IN_PROGRESS',
        }),
      );
    });

    test('should preserve startedAt when updating existing state', async () => {
      const existingState: CaseAppointmentDateBackfillState = {
        id: 'existing-id',
        documentType: 'CASE_APPOINTMENT_DATE_BACKFILL_STATE',
        lastId: 'old-cursor',
        processedCount: 5,
        startedAt: '2026-01-01T00:00:00.000Z',
        lastUpdatedAt: '2026-01-01T00:30:00.000Z',
        status: 'IN_PROGRESS',
      };

      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(existingState);
      const upsertSpy = vi
        .spyOn(MockMongoRepository.prototype, 'upsert')
        .mockResolvedValue({} as CaseAppointmentDateBackfillState);

      await BackfillCaseAppointmentDatesUseCase.updateBackfillState(context, {
        lastId: 'new-cursor',
        processedCount: 15,
        status: 'IN_PROGRESS',
      });

      expect(upsertSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'existing-id',
          startedAt: '2026-01-01T00:00:00.000Z',
          lastId: 'new-cursor',
          processedCount: 15,
        }),
      );
    });

    test('should return error when upsert fails', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'read').mockRejectedValue(
        new NotFoundError('TEST', { message: 'Not found' }),
      );
      vi.spyOn(MockMongoRepository.prototype, 'upsert').mockRejectedValue(new Error('DB error'));

      const result = await BackfillCaseAppointmentDatesUseCase.updateBackfillState(context, {
        lastId: null,
        processedCount: 0,
        status: 'FAILED',
      });

      expect(result.error).toBeDefined();
    });
  });
});
