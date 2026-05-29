import { vi } from 'vitest';
import { ApplicationContext } from '../../adapters/types/basic';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { SoftwareTrusteeCountsController } from './software-trustee-counts.controller';
import { BankruptcySoftwareUseCase } from '../../use-cases/bankruptcy-software/bankruptcy-software';
import { CamsRole } from '@common/cams/roles';
import * as FinalizeDeferrableModule from '../../deferrable/finalize-deferrable';

describe('SoftwareTrusteeCountsController', () => {
  let context: ApplicationContext;

  beforeEach(async () => {
    vi.restoreAllMocks();
    context = await createMockApplicationContext();
    context.session.user.roles = [CamsRole.SuperUser];
    context.request.params = { softwareId: 'sw-1' };
    context.request.query = {};
  });

  test('should return trustee counts for all associated banks', async () => {
    vi.spyOn(BankruptcySoftwareUseCase.prototype, 'getSoftware').mockResolvedValue({
      id: 'sw-1',
      documentType: 'BANKRUPTCY_SOFTWARE',
      name: 'Test Software',
      status: 'active',
      associatedBanks: [
        { bankId: 'bank-1', bankName: 'Chase', status: 'active' },
        { bankId: 'bank-2', bankName: 'Wells Fargo', status: 'active' },
      ],
    } as never);
    vi.spyOn(BankruptcySoftwareUseCase.prototype, 'getTrusteeCountsByBanks').mockResolvedValue({
      'bank-1': 5,
      'bank-2': 3,
    });

    const controller = new SoftwareTrusteeCountsController(context);
    const response = await controller.handleRequest(context);

    expect(response.body.data).toEqual({ 'bank-1': 5, 'bank-2': 3 });
  });

  test('should return empty counts when software has no associated banks', async () => {
    vi.spyOn(BankruptcySoftwareUseCase.prototype, 'getSoftware').mockResolvedValue({
      id: 'sw-1',
      documentType: 'BANKRUPTCY_SOFTWARE',
      name: 'Test Software',
      status: 'active',
    } as never);
    vi.spyOn(BankruptcySoftwareUseCase.prototype, 'getTrusteeCountsByBanks').mockResolvedValue({});

    const controller = new SoftwareTrusteeCountsController(context);
    const response = await controller.handleRequest(context);

    expect(response.body.data).toEqual({});
  });

  test('should throw ForbiddenError when user lacks SuperUser role', async () => {
    context.session.user.roles = [];

    const controller = new SoftwareTrusteeCountsController(context);

    await expect(controller.handleRequest(context)).rejects.toThrow(
      expect.objectContaining({ status: 403 }),
    );
  });

  test('should wrap unexpected errors with module name', async () => {
    vi.spyOn(BankruptcySoftwareUseCase.prototype, 'getSoftware').mockRejectedValue(
      new Error('database timeout'),
    );

    const controller = new SoftwareTrusteeCountsController(context);

    await expect(controller.handleRequest(context)).rejects.toThrow(
      expect.objectContaining({ module: 'SOFTWARE-TRUSTEE-COUNTS-CONTROLLER' }),
    );
  });

  test('should call finalizeDeferrable after successful request', async () => {
    const finalizeSpy = vi
      .spyOn(FinalizeDeferrableModule, 'finalizeDeferrable')
      .mockResolvedValue(undefined);
    vi.spyOn(BankruptcySoftwareUseCase.prototype, 'getSoftware').mockResolvedValue({
      id: 'sw-1',
      documentType: 'BANKRUPTCY_SOFTWARE',
      name: 'Test Software',
      status: 'active',
      associatedBanks: [],
    } as never);
    vi.spyOn(BankruptcySoftwareUseCase.prototype, 'getTrusteeCountsByBanks').mockResolvedValue({});

    const controller = new SoftwareTrusteeCountsController(context);
    await controller.handleRequest(context);

    expect(finalizeSpy).toHaveBeenCalledWith(context);
  });

  test('should call finalizeDeferrable even when request fails', async () => {
    const finalizeSpy = vi
      .spyOn(FinalizeDeferrableModule, 'finalizeDeferrable')
      .mockResolvedValue(undefined);
    vi.spyOn(BankruptcySoftwareUseCase.prototype, 'getSoftware').mockRejectedValue(
      new Error('database timeout'),
    );

    const controller = new SoftwareTrusteeCountsController(context);

    await expect(controller.handleRequest(context)).rejects.toThrow();
    expect(finalizeSpy).toHaveBeenCalledWith(context);
  });
});
