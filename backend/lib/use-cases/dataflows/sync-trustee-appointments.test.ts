import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest';
import { ApplicationContext } from '../../adapters/types/basic';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import SyncTrusteeAppointments from './sync-trustee-appointments';
import factory from '../../factory';
import { TrusteeAppointmentSyncEvent } from '@common/cams/dataflow-events';
import { CaseAppointment } from '@common/cams/trustee-appointments';
import { CasesRepository, TrusteeAppointmentsRepository } from '../gateways.types';
import * as trusteeMatchHelpers from './trustee-match.helpers';
import { closeDeferred } from '../../deferrable/defer-close';

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

    const result = await SyncTrusteeAppointments.processAppointments(context, events);

    expect(mockAppointmentsRepo.getActiveCaseAppointment).toHaveBeenCalledWith('case-001');
    expect(mockAppointmentsRepo.createCaseAppointment).toHaveBeenCalledWith(
      expect.objectContaining({
        caseId: 'case-001',
        trusteeId: 'trustee-123',
        assignedOn: expect.any(String),
      }),
    );
    expect(mockAppointmentsRepo.updateCaseAppointment).not.toHaveBeenCalled();
    expect(result[0].error).toBeUndefined();
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

  test('should set error on event and continue processing when an error occurs', async () => {
    (trusteeMatchHelpers.matchTrusteeByName as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new Error('Match failed'))
      .mockResolvedValueOnce('trustee-456');

    (mockCasesRepo.getSyncedCase as ReturnType<typeof vi.fn>).mockResolvedValue({
      caseId: 'case-002',
      trusteeId: undefined,
    });

    const events = [makeEvent('case-001', 'Bad Name'), makeEvent('case-002', 'Jane Smith')];

    const result = await SyncTrusteeAppointments.processAppointments(context, events);

    // First event should have error
    expect(result[0].error).toBeDefined();

    // Second event should succeed
    expect(result[1].error).toBeUndefined();
    expect(mockAppointmentsRepo.createCaseAppointment).toHaveBeenCalledWith(
      expect.objectContaining({
        caseId: 'case-002',
        trusteeId: 'trustee-456',
      }),
    );
  });
});
