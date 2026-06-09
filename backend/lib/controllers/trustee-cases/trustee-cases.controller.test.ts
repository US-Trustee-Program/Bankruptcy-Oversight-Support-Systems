import { vi } from 'vitest';
import { ApplicationContext } from '../../adapters/types/basic';
import { TrusteeCasesController } from './trustee-cases.controller';
import { TrusteeCasesUseCase } from '../../use-cases/trustee-cases/trustee-cases.use-case';
import { CamsRole } from '@common/cams/roles';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { TrusteeCaseListItem } from '@common/cams/trustee-appointments';
import { DEFAULT_SEARCH_LIMIT, DEFAULT_SEARCH_OFFSET } from '@common/api/search';

describe('TrusteeCasesController', () => {
  let context: ApplicationContext;
  let controller: TrusteeCasesController;

  const sampleItems: TrusteeCaseListItem[] = [
    {
      caseId: '081-24-12345',
      caseNumber: '24-12345',
      courtDivisionName: 'White Plains',
      caseTitle: 'Test Debtor',
      chapter: '7',
      dateFiled: '2024-03-15',
      appointedDate: '2024-03-20',
    },
  ];

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

    controller = new TrusteeCasesController(context);
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

  describe('GET /trustees/:trusteeId/cases', () => {
    test('returns 200 with case list items and pagination', async () => {
      vi.spyOn(TrusteeCasesUseCase.prototype, 'getCasesForTrustee').mockResolvedValue({
        data: sampleItems,
        metadata: { total: 1 },
      });
      const result = await controller.handleRequest(context);
      expect(result.statusCode).toBe(200);
      expect(result.body?.data).toEqual(sampleItems);
      expect(result.body?.pagination?.totalCount).toBe(1);
      expect(result.body?.meta).toBeDefined();
    });

    test('returns 200 with empty array when no cases', async () => {
      vi.spyOn(TrusteeCasesUseCase.prototype, 'getCasesForTrustee').mockResolvedValue({
        data: [],
        metadata: { total: 0 },
      });
      const result = await controller.handleRequest(context);
      expect(result.statusCode).toBe(200);
      expect(result.body?.data).toEqual([]);
      expect(result.body?.pagination?.totalCount).toBe(0);
    });

    test('calls use case with default limit and offset when no query params', async () => {
      const spy = vi
        .spyOn(TrusteeCasesUseCase.prototype, 'getCasesForTrustee')
        .mockResolvedValue({ data: [], metadata: { total: 0 } });
      await controller.handleRequest(context);
      expect(spy).toHaveBeenCalledWith(context, 'trustee-123', {
        limit: DEFAULT_SEARCH_LIMIT,
        offset: DEFAULT_SEARCH_OFFSET,
        caseStatus: 'ALL',
        chapters: undefined,
      });
    });

    test('calls use case with parsed limit and offset from query params', async () => {
      context.request.query = { limit: '10', offset: '20' };
      const spy = vi
        .spyOn(TrusteeCasesUseCase.prototype, 'getCasesForTrustee')
        .mockResolvedValue({ data: [], metadata: { total: 0 } });
      await controller.handleRequest(context);
      expect(spy).toHaveBeenCalledWith(context, 'trustee-123', {
        limit: 10,
        offset: 20,
        caseStatus: 'ALL',
        chapters: undefined,
      });
    });

    test('uses DEFAULT_SEARCH_LIMIT when limit is zero or negative', async () => {
      context.request.query = { limit: '0', offset: '0' };
      const spy = vi
        .spyOn(TrusteeCasesUseCase.prototype, 'getCasesForTrustee')
        .mockResolvedValue({ data: [], metadata: { total: 0 } });
      await controller.handleRequest(context);
      expect(spy).toHaveBeenCalledWith(context, 'trustee-123', {
        limit: DEFAULT_SEARCH_LIMIT,
        offset: DEFAULT_SEARCH_OFFSET,
        caseStatus: 'ALL',
        chapters: undefined,
      });
    });

    test('uses DEFAULT_SEARCH_OFFSET when offset is negative', async () => {
      context.request.query = { limit: '25', offset: '-5' };
      const spy = vi
        .spyOn(TrusteeCasesUseCase.prototype, 'getCasesForTrustee')
        .mockResolvedValue({ data: [], metadata: { total: 0 } });
      await controller.handleRequest(context);
      expect(spy).toHaveBeenCalledWith(context, 'trustee-123', {
        limit: DEFAULT_SEARCH_LIMIT,
        offset: DEFAULT_SEARCH_OFFSET,
        caseStatus: 'ALL',
        chapters: undefined,
      });
    });

    test('uses defaults when limit and offset are non-numeric', async () => {
      context.request.query = { limit: 'abc', offset: 'xyz' };
      const spy = vi
        .spyOn(TrusteeCasesUseCase.prototype, 'getCasesForTrustee')
        .mockResolvedValue({ data: [], metadata: { total: 0 } });
      await controller.handleRequest(context);
      expect(spy).toHaveBeenCalledWith(context, 'trustee-123', {
        limit: DEFAULT_SEARCH_LIMIT,
        offset: DEFAULT_SEARCH_OFFSET,
        caseStatus: 'ALL',
        chapters: undefined,
      });
    });

    test('passes caseStatus=OPEN when status=OPEN query param', async () => {
      context.request.query = { status: 'OPEN' };
      const spy = vi
        .spyOn(TrusteeCasesUseCase.prototype, 'getCasesForTrustee')
        .mockResolvedValue({ data: [], metadata: { total: 0 } });
      await controller.handleRequest(context);
      expect(spy).toHaveBeenCalledWith(
        context,
        'trustee-123',
        expect.objectContaining({ caseStatus: 'OPEN' }),
      );
    });

    test('passes caseStatus=CLOSED when status=CLOSED query param', async () => {
      context.request.query = { status: 'CLOSED' };
      const spy = vi
        .spyOn(TrusteeCasesUseCase.prototype, 'getCasesForTrustee')
        .mockResolvedValue({ data: [], metadata: { total: 0 } });
      await controller.handleRequest(context);
      expect(spy).toHaveBeenCalledWith(
        context,
        'trustee-123',
        expect.objectContaining({ caseStatus: 'CLOSED' }),
      );
    });

    test('defaults caseStatus to ALL when status param is invalid', async () => {
      context.request.query = { status: 'INVALID' };
      const spy = vi
        .spyOn(TrusteeCasesUseCase.prototype, 'getCasesForTrustee')
        .mockResolvedValue({ data: [], metadata: { total: 0 } });
      await controller.handleRequest(context);
      expect(spy).toHaveBeenCalledWith(
        context,
        'trustee-123',
        expect.objectContaining({ caseStatus: 'ALL' }),
      );
    });

    test('parses chapters as array from comma-separated query param', async () => {
      context.request.query = { chapters: '7,11' };
      const spy = vi
        .spyOn(TrusteeCasesUseCase.prototype, 'getCasesForTrustee')
        .mockResolvedValue({ data: [], metadata: { total: 0 } });
      await controller.handleRequest(context);
      expect(spy).toHaveBeenCalledWith(
        context,
        'trustee-123',
        expect.objectContaining({ chapters: ['7', '11'] }),
      );
    });

    test('passes combined status and chapters filters', async () => {
      context.request.query = { status: 'OPEN', chapters: '7' };
      const spy = vi
        .spyOn(TrusteeCasesUseCase.prototype, 'getCasesForTrustee')
        .mockResolvedValue({ data: [], metadata: { total: 0 } });
      await controller.handleRequest(context);
      expect(spy).toHaveBeenCalledWith(
        context,
        'trustee-123',
        expect.objectContaining({ caseStatus: 'OPEN', chapters: ['7'] }),
      );
    });

    test('pagination reflects correct currentPage and totalPages', async () => {
      context.request.query = { limit: '25', offset: '25' };
      vi.spyOn(TrusteeCasesUseCase.prototype, 'getCasesForTrustee').mockResolvedValue({
        data: sampleItems,
        metadata: { total: 60 },
      });
      const result = await controller.handleRequest(context);
      expect(result.body?.pagination?.currentPage).toBe(2);
      expect(result.body?.pagination?.totalPages).toBe(3);
      expect(result.body?.pagination?.totalCount).toBe(60);
    });

    test('propagates use case errors as CamsErrors', async () => {
      vi.spyOn(TrusteeCasesUseCase.prototype, 'getCasesForTrustee').mockRejectedValue(
        new Error('db connection failed'),
      );
      await expect(controller.handleRequest(context)).rejects.toMatchObject({
        isCamsError: true,
      });
    });
  });
});
