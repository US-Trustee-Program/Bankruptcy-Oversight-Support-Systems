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
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('returns CaseAppointment when repo returns one', async () => {
    vi.spyOn(MockMongoRepository.prototype, 'getActiveCaseAppointment').mockResolvedValue(
      mockAppointment,
    );
    const context = await createMockApplicationContext();
    const useCase = new CaseTrusteeAppointmentUseCase(context);

    const result = await useCase.getActiveCaseAppointment(mockAppointment.caseId);

    expect(result).toEqual(mockAppointment);
  });

  test('returns null when repo returns null', async () => {
    vi.spyOn(MockMongoRepository.prototype, 'getActiveCaseAppointment').mockResolvedValue(null);
    const context = await createMockApplicationContext();
    const useCase = new CaseTrusteeAppointmentUseCase(context);

    const result = await useCase.getActiveCaseAppointment('111-00-00001');

    expect(result).toBeNull();
  });
});
