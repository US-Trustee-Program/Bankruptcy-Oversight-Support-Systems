import { vi } from 'vitest';
import { CaseTrusteeAppointmentController } from './case-trustee-appointment.controller';
import { CaseTrusteeAppointmentUseCase } from '../../use-cases/cases/case-trustee-appointment.use-case';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { mockCamsHttpRequest } from '../../testing/mock-data/cams-http-request-helper';
import { BadRequestError } from '../../common-errors/bad-request';
import { NotFoundError } from '../../common-errors/not-found-error';
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

describe('CaseTrusteeAppointmentController', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('returns response body with appointment when found', async () => {
    vi.spyOn(CaseTrusteeAppointmentUseCase.prototype, 'getActiveCaseAppointment').mockResolvedValue(
      mockAppointment,
    );
    const context = await createMockApplicationContext();
    context.request = mockCamsHttpRequest({ params: { caseId: '111-24-00001' } });
    const controller = new CaseTrusteeAppointmentController();

    const response = await controller.handleRequest(context);

    expect(response.body?.data).toEqual(mockAppointment);
  });

  test('throws NotFoundError when use case returns null', async () => {
    vi.spyOn(CaseTrusteeAppointmentUseCase.prototype, 'getActiveCaseAppointment').mockResolvedValue(
      null,
    );
    const context = await createMockApplicationContext();
    context.request = mockCamsHttpRequest({ params: { caseId: '111-24-99999' } });
    const controller = new CaseTrusteeAppointmentController();

    await expect(controller.handleRequest(context)).rejects.toThrow(NotFoundError);
  });

  test('throws BadRequestError for invalid caseId format', async () => {
    const context = await createMockApplicationContext();
    context.request = mockCamsHttpRequest({ params: { caseId: '<script>alert(1)</script>' } });
    const controller = new CaseTrusteeAppointmentController();

    await expect(controller.handleRequest(context)).rejects.toThrow(BadRequestError);
  });
});
