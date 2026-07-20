import { vi } from 'vitest';
import { ApplicationContext } from '../../adapters/types/basic';
import { TrusteeCaseDivisionsController } from './trustee-case-divisions.controller';
import { TrusteeCasesUseCase } from '../../use-cases/trustee-cases/trustee-cases.use-case';
import { CamsRole } from '@common/cams/roles';
import { createMockApplicationContext } from '../../testing/testing-utilities';

describe('TrusteeCaseDivisionsController', () => {
  let context: ApplicationContext;
  let controller: TrusteeCaseDivisionsController;

  beforeEach(async () => {
    context = await createMockApplicationContext();
    context.session.user = { id: 'user1', name: 'Test User', roles: [CamsRole.TrusteeAdmin] };
    context.featureFlags = {
      'trustee-management': true,
      'trustee-case-list': true,
    };
    context.request.method = 'GET';
    context.request.params = { trusteeId: 'trustee-123' };
    context.request.query = {};

    controller = new TrusteeCaseDivisionsController(context);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Feature flag protection', () => {
    test('returns 404 when trustee-management flag is off', async () => {
      context.featureFlags['trustee-management'] = false;
      const result = await controller.handleRequest(context);
      expect(result.statusCode).toBe(404);
    });

    test('returns 404 when trustee-case-list flag is off', async () => {
      context.featureFlags['trustee-case-list'] = false;
      const result = await controller.handleRequest(context);
      expect(result.statusCode).toBe(404);
    });
  });

  describe('Authorization', () => {
    test('throws with status 401 when user lacks TrusteeAdmin role', async () => {
      context.session.user.roles = [CamsRole.TrialAttorney];
      await expect(controller.handleRequest(context)).rejects.toMatchObject({ status: 401 });
    });

    test('throws with status 401 when user has no roles', async () => {
      context.session.user = { id: 'u1', name: 'No Roles', roles: undefined as unknown as [] };
      await expect(controller.handleRequest(context)).rejects.toMatchObject({ status: 401 });
    });
  });

  describe('GET /trustees/:trusteeId/divisions', () => {
    test('returns 200 with division codes', async () => {
      vi.spyOn(TrusteeCasesUseCase.prototype, 'getDistinctDivisionsForTrustee').mockResolvedValue([
        '081',
        '129',
      ]);
      const result = await controller.handleRequest(context);
      expect(result.statusCode).toBe(200);
      expect(result.body?.data).toEqual(['081', '129']);
      expect(result.body?.meta).toBeDefined();
    });

    test('returns 200 with empty array when trustee has no case appointments', async () => {
      vi.spyOn(TrusteeCasesUseCase.prototype, 'getDistinctDivisionsForTrustee').mockResolvedValue(
        [],
      );
      const result = await controller.handleRequest(context);
      expect(result.statusCode).toBe(200);
      expect(result.body?.data).toEqual([]);
    });

    test('calls use case with trusteeId from route params', async () => {
      const spy = vi
        .spyOn(TrusteeCasesUseCase.prototype, 'getDistinctDivisionsForTrustee')
        .mockResolvedValue([]);
      await controller.handleRequest(context);
      expect(spy).toHaveBeenCalledWith(context, 'trustee-123');
    });

    test('propagates use case errors as CamsErrors', async () => {
      vi.spyOn(TrusteeCasesUseCase.prototype, 'getDistinctDivisionsForTrustee').mockRejectedValue(
        new Error('db connection failed'),
      );
      await expect(controller.handleRequest(context)).rejects.toMatchObject({
        isCamsError: true,
      });
    });
  });
});
