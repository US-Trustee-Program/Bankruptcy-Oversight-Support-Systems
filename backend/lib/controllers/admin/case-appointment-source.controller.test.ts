import { vi } from 'vitest';
import { ApplicationContext } from '../../adapters/types/basic';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { CaseAppointmentSourceController } from './case-appointment-source.controller';
import { CamsRole } from '@common/cams/roles';
import HttpStatusCodes from '@common/api/http-status-codes';
import * as caseAppointmentSourceUseCase from '../../use-cases/admin/case-appointment-source';
import { RegionCaseAppointmentSource } from '@common/cams/trustee-appointments';

describe('CaseAppointmentSourceController', () => {
  let context: ApplicationContext;
  let controller: CaseAppointmentSourceController;

  const mockSources: RegionCaseAppointmentSource[] = [
    { regionId: '02', regionName: 'Region 02', source: 'ACMS' },
    { regionId: '03', regionName: 'Region 03', source: 'DXTR' },
  ];

  beforeEach(async () => {
    vi.restoreAllMocks();
    context = await createMockApplicationContext();
    context.session.user.roles = [CamsRole.SuperUser];
    controller = new CaseAppointmentSourceController();
  });

  describe('authorization', () => {
    test('throws ForbiddenError when user lacks SuperUser role', async () => {
      context.session.user.roles = [CamsRole.TrialAttorney];
      context.request.method = 'GET';

      await expect(controller.handleRequest(context)).rejects.toThrow(
        expect.objectContaining({ status: HttpStatusCodes.FORBIDDEN }),
      );
    });

    test('throws ForbiddenError when user has no roles', async () => {
      context.session.user.roles = [];
      context.request.method = 'GET';

      await expect(controller.handleRequest(context)).rejects.toThrow(
        expect.objectContaining({ status: HttpStatusCodes.FORBIDDEN }),
      );
    });
  });

  describe('handleRequest', () => {
    test('returns every region source on GET', async () => {
      context.request.method = 'GET';
      vi.spyOn(caseAppointmentSourceUseCase, 'getCaseAppointmentSources').mockResolvedValue(
        mockSources,
      );

      const result = await controller.handleRequest(context);

      expect(result.statusCode).toBe(HttpStatusCodes.OK);
      expect(result.body.data).toEqual(mockSources);
    });

    test('returns method not allowed for a non-GET method', async () => {
      context.request.method = 'PUT';

      const result = await controller.handleRequest(context);

      expect(result.statusCode).toBe(HttpStatusCodes.METHOD_NOT_ALLOWED);
    });

    test('propagates a use case failure', async () => {
      context.request.method = 'GET';
      const error = new Error('Cosmos throttled');
      vi.spyOn(caseAppointmentSourceUseCase, 'getCaseAppointmentSources').mockRejectedValue(error);

      await expect(controller.handleRequest(context)).rejects.toThrow();
    });
  });
});
