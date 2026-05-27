import { vi } from 'vitest';
import { ApplicationContext } from '../../adapters/types/basic';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { BankTrusteesController } from './bank-trustees.controller';
import { BanksUseCase } from '../../use-cases/banks/banks';
import { CamsRole } from '@common/cams/roles';
import { TrusteeSummary } from '@common/cams/trustees';

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

  test('should fall back to defaults when limit is NaN', async () => {
    context.request.query = { limit: 'abc', offset: '-5' };
    const spy = vi.spyOn(BanksUseCase.prototype, 'getTrusteesByBank').mockResolvedValue({
      metadata: { total: 0 },
      data: [],
    });

    const controller = new BankTrusteesController(context);
    await controller.handleRequest(context);

    expect(spy).toHaveBeenCalledWith('bank-1', 25, 0);
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
});
