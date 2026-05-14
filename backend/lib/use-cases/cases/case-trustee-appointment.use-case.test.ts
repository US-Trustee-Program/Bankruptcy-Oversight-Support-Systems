import { vi } from 'vitest';
import { CaseTrusteeAppointmentUseCase } from './case-trustee-appointment.use-case';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { CaseAppointment } from '@common/cams/trustee-appointments';

const mockAppointment: CaseAppointment = {
  id: 'ca-001',
  caseId: '111-24-00001',
  trusteeId: 'trustee-abc',
  assignedOn: '2026-01-01T00:00:00Z',
  appointedDate: '2026-01-01',
  createdOn: '2026-01-01T00:00:00Z',
  createdBy: { id: 'system', name: 'System' },
  updatedOn: '2026-01-01T00:00:00Z',
  updatedBy: { id: 'system', name: 'System' },
};

describe('CaseTrusteeAppointmentUseCase', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test('returns CaseAppointment when repo returns one', async () => {
    vi.spyOn(MockMongoRepository.prototype, 'getActiveCaseAppointment').mockResolvedValue(
      mockAppointment,
    );
    const context = await createMockApplicationContext();
    const useCase = new CaseTrusteeAppointmentUseCase();

    const result = await useCase.getActiveCaseAppointment(context, mockAppointment.caseId);

    expect(result).toEqual(mockAppointment);
  });

  test('returns null when repo returns null', async () => {
    vi.spyOn(MockMongoRepository.prototype, 'getActiveCaseAppointment').mockResolvedValue(null);
    const context = await createMockApplicationContext();
    const useCase = new CaseTrusteeAppointmentUseCase();

    const result = await useCase.getActiveCaseAppointment(context, '111-00-00001');

    expect(result).toBeNull();
  });

  test('wraps repository error with getCamsError for getActiveCaseAppointment', async () => {
    vi.spyOn(MockMongoRepository.prototype, 'getActiveCaseAppointment').mockRejectedValue(
      new Error('DB failure'),
    );
    const context = await createMockApplicationContext();
    const useCase = new CaseTrusteeAppointmentUseCase();

    await expect(useCase.getActiveCaseAppointment(context, '111-24-00001')).rejects.toThrow();
  });

  describe('getCaseTrusteeAppointmentHistory', () => {
    const activeAppointment: CaseAppointment = {
      id: 'ca-active',
      caseId: '111-24-00001',
      trusteeId: 'trustee-abc',
      assignedOn: '2026-01-01T00:00:00Z',
      appointedDate: '2026-01-01',
      createdOn: '2026-01-01T00:00:00Z',
      createdBy: { id: 'system', name: 'System' },
      updatedOn: '2026-01-01T00:00:00Z',
      updatedBy: { id: 'system', name: 'System' },
      // no unassignedOn
    };

    const past1: CaseAppointment = {
      ...activeAppointment,
      id: 'ca-past-1',
      trusteeId: 'trustee-old-1',
      appointedDate: '2025-06-01',
      unassignedOn: '2025-06-01T00:00:00Z',
    };

    const past2: CaseAppointment = {
      ...activeAppointment,
      id: 'ca-past-2',
      trusteeId: 'trustee-old-2',
      appointedDate: '2024-01-01',
      unassignedOn: '2024-01-01T00:00:00Z',
    };

    test('splits all appointments into current and history, sorted desc', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'findByCaseId').mockResolvedValue([
        activeAppointment,
        past2, // intentionally out of order
        past1,
      ]);
      const context = await createMockApplicationContext();
      const useCase = new CaseTrusteeAppointmentUseCase();

      const result = await useCase.getCaseTrusteeAppointmentHistory(context, '111-24-00001');

      expect(result.current).toEqual(activeAppointment);
      expect(result.history).toEqual([past1, past2]); // most recently ended first
    });

    test('returns { current: null, history: [] } when no appointments exist', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'findByCaseId').mockResolvedValue([]);
      const context = await createMockApplicationContext();
      const useCase = new CaseTrusteeAppointmentUseCase();

      const result = await useCase.getCaseTrusteeAppointmentHistory(context, '111-24-00001');

      expect(result.current).toBeNull();
      expect(result.history).toEqual([]);
    });

    test('wraps repository error with getCamsError', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'findByCaseId').mockRejectedValue(
        new Error('DB failure'),
      );
      const context = await createMockApplicationContext();
      const useCase = new CaseTrusteeAppointmentUseCase();

      await expect(
        useCase.getCaseTrusteeAppointmentHistory(context, '111-24-00001'),
      ).rejects.toThrow();
    });
  });
});
