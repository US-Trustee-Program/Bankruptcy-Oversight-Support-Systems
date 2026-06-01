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

  test('should return trustee counts from the use case', async () => {
    const spy = vi
      .spyOn(BankruptcySoftwareUseCase.prototype, 'getTrusteeCountsBySoftware')
      .mockResolvedValue({
        'bank-1': 5,
        'bank-2': 3,
      });

    const controller = new SoftwareTrusteeCountsController(context);
    const response = await controller.handleRequest(context);

    expect(spy).toHaveBeenCalledWith('sw-1');
    expect(response.body.data).toEqual({ 'bank-1': 5, 'bank-2': 3 });
  });

  test('should throw ForbiddenError when user lacks SuperUser role', async () => {
    context.session.user.roles = [];

    const controller = new SoftwareTrusteeCountsController(context);

    await expect(controller.handleRequest(context)).rejects.toThrow(
      expect.objectContaining({ status: 403 }),
    );
  });

  test('should throw ForbiddenError when user roles is undefined', async () => {
    context.session.user.roles = undefined;

    const controller = new SoftwareTrusteeCountsController(context);

    await expect(controller.handleRequest(context)).rejects.toThrow(
      expect.objectContaining({ status: 403 }),
    );
  });

  test('should wrap use case errors as CamsError', async () => {
    vi.spyOn(BankruptcySoftwareUseCase.prototype, 'getTrusteeCountsBySoftware').mockRejectedValue(
      new Error('database timeout'),
    );

    const controller = new SoftwareTrusteeCountsController(context);

    await expect(controller.handleRequest(context)).rejects.toThrow(
      expect.objectContaining({ status: 500 }),
    );
  });

  test('should call finalizeDeferrable after successful request', async () => {
    const finalizeSpy = vi
      .spyOn(FinalizeDeferrableModule, 'finalizeDeferrable')
      .mockResolvedValue(undefined);
    vi.spyOn(BankruptcySoftwareUseCase.prototype, 'getTrusteeCountsBySoftware').mockResolvedValue(
      {},
    );

    const controller = new SoftwareTrusteeCountsController(context);
    await controller.handleRequest(context);

    expect(finalizeSpy).toHaveBeenCalledWith(context);
  });

  test('should call finalizeDeferrable even when request fails', async () => {
    const finalizeSpy = vi
      .spyOn(FinalizeDeferrableModule, 'finalizeDeferrable')
      .mockResolvedValue(undefined);
    vi.spyOn(BankruptcySoftwareUseCase.prototype, 'getTrusteeCountsBySoftware').mockRejectedValue(
      new Error('database timeout'),
    );

    const controller = new SoftwareTrusteeCountsController(context);

    await expect(controller.handleRequest(context)).rejects.toThrow();
    expect(finalizeSpy).toHaveBeenCalledWith(context);
  });
});
