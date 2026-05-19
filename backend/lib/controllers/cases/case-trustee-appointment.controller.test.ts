import { vi } from 'vitest';
import { CaseTrusteeAppointmentController } from './case-trustee-appointment.controller';
import { CaseTrusteeAppointmentUseCase } from '../../use-cases/cases/case-trustee-appointment.use-case';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { mockCamsHttpRequest } from '../../testing/mock-data/cams-http-request-helper';
import { BadRequestError } from '../../common-errors/bad-request';
import { NotFoundError } from '../../common-errors/not-found-error';
import { CaseAppointment } from '@common/cams/trustee-appointments';
import { ApplicationContext } from '../../adapters/types/basic';

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
  let context: ApplicationContext;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('flag off — original behavior', () => {
    beforeEach(async () => {
      context = await createMockApplicationContext();
      context.featureFlags['trustee-appointment-history-enabled'] = false;
      context.request = mockCamsHttpRequest({ params: { caseId: '111-24-00001' } });
    });

    test('returns response body with appointment when found', async () => {
      vi.spyOn(
        CaseTrusteeAppointmentUseCase.prototype,
        'getActiveCaseAppointment',
      ).mockResolvedValue(mockAppointment);
      const controller = new CaseTrusteeAppointmentController();

      const response = await controller.handleRequest(context);

      expect(response.body?.data).toEqual(mockAppointment);
    });

    test('throws NotFoundError when use case returns null', async () => {
      vi.spyOn(
        CaseTrusteeAppointmentUseCase.prototype,
        'getActiveCaseAppointment',
      ).mockResolvedValue(null);
      context.request = mockCamsHttpRequest({ params: { caseId: '111-24-99999' } });
      const controller = new CaseTrusteeAppointmentController();

      await expect(controller.handleRequest(context)).rejects.toThrow(NotFoundError);
    });

    test('throws BadRequestError for invalid caseId format', async () => {
      context.request = mockCamsHttpRequest({ params: { caseId: '<script>alert(1)</script>' } });
      const controller = new CaseTrusteeAppointmentController();

      await expect(controller.handleRequest(context)).rejects.toThrow(BadRequestError);
    });

    test('passes context and caseId to use case', async () => {
      const spy = vi
        .spyOn(CaseTrusteeAppointmentUseCase.prototype, 'getActiveCaseAppointment')
        .mockResolvedValue(mockAppointment);
      const controller = new CaseTrusteeAppointmentController();

      await controller.handleRequest(context);

      expect(spy).toHaveBeenCalledWith(context, '111-24-00001');
    });
  });

  describe('flag on — history enabled', () => {
    const pastAppointment: CaseAppointment = {
      id: 'ca-old',
      caseId: '111-24-00001',
      trusteeId: 'trustee-xyz',
      assignedOn: '2024-01-01T00:00:00Z',
      appointedDate: '2024-01-01',
      unassignedOn: '2025-01-01T00:00:00Z',
      createdOn: '2024-01-01T00:00:00Z',
      createdBy: { id: 'system', name: 'System' },
      updatedOn: '2025-01-01T00:00:00Z',
      updatedBy: { id: 'system', name: 'System' },
    };

    beforeEach(async () => {
      context = await createMockApplicationContext();
      context.featureFlags['trustee-appointment-history-enabled'] = true;
      context.request = mockCamsHttpRequest({ params: { caseId: '111-24-00001' } });
    });

    test('returns current and history when both exist', async () => {
      vi.spyOn(
        CaseTrusteeAppointmentUseCase.prototype,
        'getCaseTrusteeAppointmentHistory',
      ).mockResolvedValue({ current: mockAppointment, history: [pastAppointment] });
      const controller = new CaseTrusteeAppointmentController();

      const response = await controller.handleRequest(context);

      expect(response.body?.data).toEqual({
        current: mockAppointment,
        history: [pastAppointment],
      });
    });

    test('returns { current: null, history: [] } with 200 when no appointments exist', async () => {
      vi.spyOn(
        CaseTrusteeAppointmentUseCase.prototype,
        'getCaseTrusteeAppointmentHistory',
      ).mockResolvedValue({ current: null, history: [] });
      const controller = new CaseTrusteeAppointmentController();

      const response = await controller.handleRequest(context);

      expect(response.statusCode).not.toBe(404);
      expect(response.body?.data).toEqual({ current: null, history: [] });
    });

    test('returns { current, history: [] } when only active appointment exists', async () => {
      vi.spyOn(
        CaseTrusteeAppointmentUseCase.prototype,
        'getCaseTrusteeAppointmentHistory',
      ).mockResolvedValue({ current: mockAppointment, history: [] });
      const controller = new CaseTrusteeAppointmentController();

      const response = await controller.handleRequest(context);

      expect(response.body?.data).toEqual({ current: mockAppointment, history: [] });
    });

    test('throws BadRequestError for invalid caseId format even when flag is on', async () => {
      context.request = mockCamsHttpRequest({ params: { caseId: '<script>alert(1)</script>' } });
      const controller = new CaseTrusteeAppointmentController();

      await expect(controller.handleRequest(context)).rejects.toThrow(BadRequestError);
    });

    test('passes context and caseId to use case getCaseTrusteeAppointmentHistory', async () => {
      const spy = vi
        .spyOn(CaseTrusteeAppointmentUseCase.prototype, 'getCaseTrusteeAppointmentHistory')
        .mockResolvedValue({ current: mockAppointment, history: [] });
      const controller = new CaseTrusteeAppointmentController();

      await controller.handleRequest(context);

      expect(spy).toHaveBeenCalledWith(context, '111-24-00001');
    });
  });
});
