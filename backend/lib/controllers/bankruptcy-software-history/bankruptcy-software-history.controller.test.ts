import { vi } from 'vitest';
import { ApplicationContext } from '../../adapters/types/basic';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { BankruptcySoftwareHistoryController } from './bankruptcy-software-history.controller';
import { BankruptcySoftwareUseCase } from '../../use-cases/bankruptcy-software/bankruptcy-software';
import { CamsRole } from '@common/cams/roles';
import { BankruptcySoftwareAuditHistory } from '@common/cams/bankruptcy-software';

describe('BankruptcySoftwareHistoryController', () => {
  let context: ApplicationContext;

  beforeEach(async () => {
    context = await createMockApplicationContext();
    context.session.user.roles = [CamsRole.SuperUser];
    context.request.params = { softwareId: 'sw-1' };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should return history for SuperUser', async () => {
    const mockHistory: BankruptcySoftwareAuditHistory[] = [
      {
        id: 'hist-1',
        documentType: 'AUDIT_BANKRUPTCY_SOFTWARE',
        softwareId: 'sw-1',
        before: { name: 'Old Name', status: 'active' },
        after: { name: 'New Name', status: 'active' },
        updatedOn: '2024-01-02T00:00:00.000Z',
        updatedBy: { id: 'user-1', name: 'User One' },
      },
    ];
    vi.spyOn(BankruptcySoftwareUseCase.prototype, 'getSoftwareHistory').mockResolvedValue(
      mockHistory,
    );

    const controller = new BankruptcySoftwareHistoryController(context);
    const response = await controller.handleRequest(context);

    expect(response.body.data).toEqual(mockHistory);
  });

  test('should throw ForbiddenError when user lacks SuperUser role', async () => {
    context.session.user.roles = [];

    const controller = new BankruptcySoftwareHistoryController(context);

    await expect(controller.handleRequest(context)).rejects.toThrow(
      expect.objectContaining({ status: 403 }),
    );
  });
});
