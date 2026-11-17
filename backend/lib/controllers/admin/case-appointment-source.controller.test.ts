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
    test.each([
      { description: 'lacks the SuperUser role', roles: [CamsRole.TrialAttorney], method: 'GET' },
      { description: 'has no roles', roles: [], method: 'GET' },
      { description: 'has an undefined roles list', roles: undefined, method: 'GET' },
      { description: 'lacks the SuperUser role on a non-GET method', roles: [], method: 'PUT' },
      { description: 'lacks the SuperUser role on PATCH', roles: [], method: 'PATCH' },
    ] as const)(
      'should throw ForbiddenError without reading sources when the user $description',
      async ({ roles, method }) => {
        context.session.user.roles = roles ? [...roles] : undefined;
        context.request.method = method;
        const useCaseSpy = vi.spyOn(caseAppointmentSourceUseCase, 'getCaseAppointmentSources');
        const patchUseCaseSpy = vi.spyOn(
          caseAppointmentSourceUseCase,
          'switchCaseAppointmentSourceToDxtr',
        );

        await expect(controller.handleRequest(context)).rejects.toThrow(
          expect.objectContaining({ status: HttpStatusCodes.FORBIDDEN }),
        );
        expect(useCaseSpy).not.toHaveBeenCalled();
        expect(patchUseCaseSpy).not.toHaveBeenCalled();
      },
    );
  });

  describe('handleRequest', () => {
    test('should return the use case results with meta.self on GET', async () => {
      context.request.method = 'GET';
      vi.spyOn(caseAppointmentSourceUseCase, 'getCaseAppointmentSources').mockResolvedValue(
        mockSources,
      );

      const result = await controller.handleRequest(context);

      expect(result.statusCode).toBe(HttpStatusCodes.OK);
      expect(result.body).toEqual({ meta: { self: context.request.url }, data: mockSources });
    });

    test('should return method not allowed for a non-GET, non-PATCH method', async () => {
      context.request.method = 'PUT';

      const result = await controller.handleRequest(context);

      expect(result.statusCode).toBe(HttpStatusCodes.METHOD_NOT_ALLOWED);
    });

    test('should rethrow a use case failure unchanged', async () => {
      context.request.method = 'GET';
      const error = new Error('Cosmos throttled');
      vi.spyOn(caseAppointmentSourceUseCase, 'getCaseAppointmentSources').mockRejectedValue(error);

      await expect(controller.handleRequest(context)).rejects.toBe(error);
    });
  });

  describe('PATCH', () => {
    const switchedRegion: RegionCaseAppointmentSource = {
      regionId: '02',
      regionName: 'Region 02',
      source: 'DXTR',
    };

    beforeEach(() => {
      context.request.method = 'PATCH';
      context.request.params = { regionId: '02' };
      context.request.body = { source: 'DXTR' };
    });

    test('should switch the region and return it with meta.self on a valid request', async () => {
      const useCaseSpy = vi
        .spyOn(caseAppointmentSourceUseCase, 'switchCaseAppointmentSourceToDxtr')
        .mockResolvedValue(switchedRegion);

      const result = await controller.handleRequest(context);

      expect(useCaseSpy).toHaveBeenCalledWith(context, '02');
      expect(result.statusCode).toBe(HttpStatusCodes.OK);
      expect(result.body).toEqual({ meta: { self: context.request.url }, data: switchedRegion });
    });

    test.each([
      { description: 'regionId is missing', params: {}, body: { source: 'DXTR' } },
      { description: 'source is ACMS', params: { regionId: '02' }, body: { source: 'ACMS' } },
      { description: 'source is missing', params: { regionId: '02' }, body: {} },
      {
        description: 'source is some other value',
        params: { regionId: '02' },
        body: { source: 'OTHER' },
      },
      { description: 'body is not an object', params: { regionId: '02' }, body: 'DXTR' },
      { description: 'body is null', params: { regionId: '02' }, body: null },
    ])(
      'should throw BadRequestError and call the use case zero times when $description',
      async ({ params, body }) => {
        context.request.params = params;
        context.request.body = body;
        const useCaseSpy = vi.spyOn(
          caseAppointmentSourceUseCase,
          'switchCaseAppointmentSourceToDxtr',
        );

        await expect(controller.handleRequest(context)).rejects.toThrow(
          expect.objectContaining({ status: HttpStatusCodes.BAD_REQUEST }),
        );
        expect(useCaseSpy).not.toHaveBeenCalled();
      },
    );

    test('should rethrow a use case failure unchanged (e.g. NotFoundError for an unknown region)', async () => {
      const error = new Error('region not found');
      vi.spyOn(caseAppointmentSourceUseCase, 'switchCaseAppointmentSourceToDxtr').mockRejectedValue(
        error,
      );

      await expect(controller.handleRequest(context)).rejects.toBe(error);
    });
  });
});
