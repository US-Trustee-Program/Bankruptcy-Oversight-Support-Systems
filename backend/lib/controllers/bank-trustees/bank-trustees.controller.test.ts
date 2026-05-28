import { vi } from 'vitest';
import { ApplicationContext } from '../../adapters/types/basic';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { BankTrusteesController } from './bank-trustees.controller';
import { BanksUseCase } from '../../use-cases/banks/banks';
import { CamsRole } from '@common/cams/roles';
import { TrusteeSummary } from '@common/cams/trustees';
import * as FinalizeDeferrableModule from '../../deferrable/finalize-deferrable';

describe('BankTrusteesController', () => {
  let context: ApplicationContext;

  beforeEach(async () => {
    vi.restoreAllMocks();
    context = await createMockApplicationContext();
    context.session.user.roles = [CamsRole.SuperUser];
    context.request.params = { bankId: 'bank-1' };
    context.request.query = {};
  });

  test('should return paginated trustees for SuperUser', async () => {
    const mockTrustees: TrusteeSummary[] = [
      { id: 'doc-1', trusteeId: 'trustee-1', name: 'Adams, John' },
      { id: 'doc-2', trusteeId: 'trustee-2', name: 'Baker, Jane' },
    ];
    vi.spyOn(BanksUseCase.prototype, 'getTrusteesByBank').mockResolvedValue({
      metadata: { total: 2 },
      data: mockTrustees,
    });

    const controller = new BankTrusteesController(context);
    const response = await controller.handleRequest(context);

    expect(response.body.data).toEqual(mockTrustees);
    expect(response.body.pagination).toEqual({
      count: 2,
      totalCount: 2,
      currentPage: 1,
      totalPages: 1,
      limit: 25,
    });
  });

  test('should parse limit and offset from query params', async () => {
    context.request.query = { limit: '10', offset: '20' };
    vi.spyOn(BanksUseCase.prototype, 'getTrusteesByBank').mockResolvedValue({
      metadata: { total: 50 },
      data: Array(10).fill({ id: 'x', trusteeId: 'y', name: 'Z' }),
    });

    const controller = new BankTrusteesController(context);
    const response = await controller.handleRequest(context);

    expect(response.body.pagination).toEqual({
      count: 10,
      totalCount: 50,
      currentPage: 3,
      totalPages: 5,
      limit: 10,
    });
  });

  test('should default limit to 25 and offset to 0 when not provided', async () => {
    const spy = vi.spyOn(BanksUseCase.prototype, 'getTrusteesByBank').mockResolvedValue({
      metadata: { total: 0 },
      data: [],
    });

    const controller = new BankTrusteesController(context);
    await controller.handleRequest(context);

    expect(spy).toHaveBeenCalledWith('bank-1', 25, 0);
  });

  test.each([
    {
      query: { limit: '0' },
      expectedLimit: 25,
      expectedOffset: 0,
      desc: 'zero limit falls back to default',
    },
    {
      query: { offset: '0' },
      expectedLimit: 25,
      expectedOffset: 0,
      desc: 'zero offset is accepted as valid',
    },
    {
      query: { limit: 'abc' },
      expectedLimit: 25,
      expectedOffset: 0,
      desc: 'non-numeric limit falls back to default',
    },
    {
      query: { offset: '-5' },
      expectedLimit: 25,
      expectedOffset: 0,
      desc: 'negative offset falls back to default',
    },
  ])(
    'should handle query param boundary: $desc',
    async ({ query, expectedLimit, expectedOffset }) => {
      context.request.query = query;
      const spy = vi.spyOn(BanksUseCase.prototype, 'getTrusteesByBank').mockResolvedValue({
        metadata: { total: 0 },
        data: [],
      });

      const controller = new BankTrusteesController(context);
      await controller.handleRequest(context);

      expect(spy).toHaveBeenCalledWith('bank-1', expectedLimit, expectedOffset);
    },
  );

  test('should default totalCount to 0 when metadata is missing', async () => {
    vi.spyOn(BanksUseCase.prototype, 'getTrusteesByBank').mockResolvedValue({
      data: [],
    });

    const controller = new BankTrusteesController(context);
    const response = await controller.handleRequest(context);

    expect(response.body.pagination.totalCount).toBe(0);
  });

  test('should wrap unexpected errors with module name', async () => {
    vi.spyOn(BanksUseCase.prototype, 'getTrusteesByBank').mockRejectedValue(
      new Error('database timeout'),
    );

    const controller = new BankTrusteesController(context);

    await expect(controller.handleRequest(context)).rejects.toThrow(
      expect.objectContaining({ module: 'BANK-TRUSTEES-CONTROLLER' }),
    );
  });

  test('should throw ForbiddenError when user lacks SuperUser role', async () => {
    context.session.user.roles = [];

    const controller = new BankTrusteesController(context);

    await expect(controller.handleRequest(context)).rejects.toThrow(
      expect.objectContaining({ status: 403 }),
    );
  });

  test('should call finalizeDeferrable after successful request', async () => {
    const finalizeSpy = vi
      .spyOn(FinalizeDeferrableModule, 'finalizeDeferrable')
      .mockResolvedValue(undefined);
    vi.spyOn(BanksUseCase.prototype, 'getTrusteesByBank').mockResolvedValue({
      metadata: { total: 0 },
      data: [],
    });

    const controller = new BankTrusteesController(context);
    await controller.handleRequest(context);

    expect(finalizeSpy).toHaveBeenCalledWith(context);
  });

  test('should call finalizeDeferrable even when request fails', async () => {
    const finalizeSpy = vi
      .spyOn(FinalizeDeferrableModule, 'finalizeDeferrable')
      .mockResolvedValue(undefined);
    vi.spyOn(BanksUseCase.prototype, 'getTrusteesByBank').mockRejectedValue(
      new Error('database timeout'),
    );

    const controller = new BankTrusteesController(context);

    await expect(controller.handleRequest(context)).rejects.toThrow();
    expect(finalizeSpy).toHaveBeenCalledWith(context);
  });
});
