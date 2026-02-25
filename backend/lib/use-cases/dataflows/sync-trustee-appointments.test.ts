import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest';
import { ApplicationContext } from '../../adapters/types/basic';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import SyncTrusteeAppointments from './sync-trustee-appointments';
import factory from '../../factory';
import {
  TrusteeAppointmentSyncError,
  TrusteeAppointmentSyncEvent,
} from '@common/cams/dataflow-events';
import { CaseAppointment } from '@common/cams/trustee-appointments';
import { CasesRepository, TrusteeAppointmentsRepository } from '../gateways.types';
import * as trusteeMatchHelpers from './trustee-match.helpers';
import { closeDeferred } from '../../deferrable/defer-close';
import { CamsError } from '../../common-errors/cams-error';
import { NotFoundError } from '../../common-errors/not-found-error';

describe('SyncTrusteeAppointments.processAppointments', () => {
  let context: ApplicationContext;
  let mockCasesRepo: Partial<CasesRepository>;
  let mockAppointmentsRepo: Partial<TrusteeAppointmentsRepository>;

  const makeEvent = (caseId: string, fullName: string): TrusteeAppointmentSyncEvent => ({
    caseId,
    courtId: '081',
    dxtrTrustee: { fullName },
  });

  beforeEach(async () => {
    context = await createMockApplicationContext();

    mockCasesRepo = {
      getSyncedCase: vi.fn().mockResolvedValue({ caseId: 'case-001', trusteeId: undefined }),
      syncDxtrCase: vi.fn().mockResolvedValue(undefined),
      release: vi.fn(),
    };

    mockAppointmentsRepo = {
      getActiveCaseAppointment: vi.fn().mockResolvedValue(null),
      createCaseAppointment: vi.fn().mockResolvedValue({}),
      updateCaseAppointment: vi.fn().mockResolvedValue({}),
      release: vi.fn(),
    };

    vi.spyOn(factory, 'getCasesRepository').mockReturnValue(mockCasesRepo as CasesRepository);
    vi.spyOn(factory, 'getTrusteeAppointmentsRepository').mockReturnValue(
      mockAppointmentsRepo as TrusteeAppointmentsRepository,
    );
    vi.spyOn(trusteeMatchHelpers, 'matchTrusteeByName').mockResolvedValue('trustee-123');
  });

  afterEach(async () => {
    await closeDeferred(context);
    vi.restoreAllMocks();
  });

  test('should create a new CASE_APPOINTMENT when no existing appointment', async () => {
    const events = [makeEvent('case-001', 'John Doe')];

    const { successCount, dlqMessages } = await SyncTrusteeAppointments.processAppointments(
      context,
      events,
    );

    expect(mockAppointmentsRepo.getActiveCaseAppointment).toHaveBeenCalledWith('case-001');
    expect(mockAppointmentsRepo.createCaseAppointment).toHaveBeenCalledWith(
      expect.objectContaining({
        documentType: 'CASE_APPOINTMENT',
        caseId: 'case-001',
        trusteeId: 'trustee-123',
        assignedOn: expect.any(String),
      }),
    );
    expect(mockAppointmentsRepo.updateCaseAppointment).not.toHaveBeenCalled();
    expect(successCount).toBe(1);
    expect(dlqMessages).toHaveLength(0);
  });

  test('should skip when existing appointment has the same trusteeId', async () => {
    const existingAppointment: CaseAppointment = {
      id: 'ca-1',
      documentType: 'CASE_APPOINTMENT',
      caseId: 'case-001',
      trusteeId: 'trustee-123',
      assignedOn: '2024-01-01T00:00:00Z',
      updatedOn: '2024-01-01T00:00:00Z',
      updatedBy: { id: 'user-1', name: 'Test User' },
    };
    (mockAppointmentsRepo.getActiveCaseAppointment as ReturnType<typeof vi.fn>).mockResolvedValue(
      existingAppointment,
    );

    const events = [makeEvent('case-001', 'John Doe')];

    const { successCount, dlqMessages } = await SyncTrusteeAppointments.processAppointments(
      context,
      events,
    );

    expect(mockAppointmentsRepo.updateCaseAppointment).not.toHaveBeenCalled();
    expect(mockAppointmentsRepo.createCaseAppointment).not.toHaveBeenCalled();
    expect(successCount).toBe(1);
    expect(dlqMessages).toHaveLength(0);
  });

  test('should soft-close old and create new when trustee changes', async () => {
    const existingAppointment: CaseAppointment = {
      id: 'ca-old',
      documentType: 'CASE_APPOINTMENT',
      caseId: 'case-001',
      trusteeId: 'old-trustee',
      assignedOn: '2024-01-01T00:00:00Z',
      updatedOn: '2024-01-01T00:00:00Z',
      updatedBy: { id: 'user-1', name: 'Test User' },
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
        documentType: 'CASE_APPOINTMENT',
        caseId: 'case-001',
        trusteeId: 'trustee-123',
        assignedOn: expect.any(String),
      }),
    );
  });

  test('should add unclassified error to dlqMessages and continue processing', async () => {
    (trusteeMatchHelpers.matchTrusteeByName as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new Error('Unexpected failure'))
      .mockResolvedValueOnce('trustee-456');

    (mockCasesRepo.getSyncedCase as ReturnType<typeof vi.fn>).mockResolvedValue({
      caseId: 'case-002',
      trusteeId: undefined,
    });

    const events = [makeEvent('case-001', 'Bad Name'), makeEvent('case-002', 'Jane Smith')];

    const { successCount, dlqMessages } = await SyncTrusteeAppointments.processAppointments(
      context,
      events,
    );

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
  });

  test('should send TrusteeAppointmentSyncError with NO_TRUSTEE_MATCH to DLQ when no trustee found', async () => {
    const noMatchError = new CamsError('TRUSTEE-MATCH', {
      message: 'No match',
      data: { mismatchReason: 'NO_TRUSTEE_MATCH' },
    });
    (trusteeMatchHelpers.matchTrusteeByName as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      noMatchError,
    );

    const { dlqMessages, successCount } = await SyncTrusteeAppointments.processAppointments(
      context,
      [makeEvent('case-001', 'Ghost Trustee')],
    );

    expect(dlqMessages).toHaveLength(1);
    expect((dlqMessages[0] as TrusteeAppointmentSyncError).mismatchReason).toBe('NO_TRUSTEE_MATCH');
    expect((dlqMessages[0] as TrusteeAppointmentSyncError).caseId).toBe('case-001');
    expect(mockAppointmentsRepo.createCaseAppointment).not.toHaveBeenCalled();
    expect(successCount).toBe(0);
  });

  test('should send TrusteeAppointmentSyncError with MULTIPLE_TRUSTEES_MATCH and candidateTrusteeIds to DLQ', async () => {
    const multiMatchError = new CamsError('TRUSTEE-MATCH', {
      message: 'Multiple match',
      data: { mismatchReason: 'MULTIPLE_TRUSTEES_MATCH', candidateTrusteeIds: ['t-1', 't-2'] },
    });
    (trusteeMatchHelpers.matchTrusteeByName as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      multiMatchError,
    );

    const { dlqMessages } = await SyncTrusteeAppointments.processAppointments(context, [
      makeEvent('case-001', 'Common Name'),
    ]);

    const err = dlqMessages[0] as TrusteeAppointmentSyncError;
    expect(err.mismatchReason).toBe('MULTIPLE_TRUSTEES_MATCH');
    expect(err.candidateTrusteeIds).toEqual(['t-1', 't-2']);
    expect(mockAppointmentsRepo.createCaseAppointment).not.toHaveBeenCalled();
  });

  test('should send TrusteeAppointmentSyncError with CASE_NOT_FOUND to DLQ when case is missing from Cosmos', async () => {
    (mockCasesRepo.getSyncedCase as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new NotFoundError('CASES-REPO', { message: 'Case not found' }),
    );

    const { dlqMessages } = await SyncTrusteeAppointments.processAppointments(context, [
      makeEvent('missing-case', 'John Doe'),
    ]);

    const err = dlqMessages[0] as TrusteeAppointmentSyncError;
    expect(err.mismatchReason).toBe('CASE_NOT_FOUND');
    expect(err.caseId).toBe('missing-case');
    expect(mockAppointmentsRepo.createCaseAppointment).not.toHaveBeenCalled();
  });
});
