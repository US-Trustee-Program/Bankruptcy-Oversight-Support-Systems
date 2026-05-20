import { vi } from 'vitest';
import { ApplicationContext } from '../../adapters/types/basic';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { BankHistoryController } from './bank-history.controller';
import { BanksUseCase } from '../../use-cases/banks/banks';
import { CamsRole } from '@common/cams/roles';
import { BankAuditHistory } from '@common/cams/banks';

describe('BankHistoryController', () => {
  let context: ApplicationContext;

  beforeEach(async () => {
    context = await createMockApplicationContext();
    context.session.user.roles = [CamsRole.SuperUser];
    context.request.params = { bankId: 'bank-1' };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should return history for SuperUser', async () => {
    const mockHistory: BankAuditHistory[] = [
      {
        id: 'hist-1',
        documentType: 'AUDIT_BANK',
        bankId: 'bank-1',
        before: { name: 'Old Name', status: 'active' },
        after: { name: 'New Name', status: 'active' },
        updatedOn: '2024-01-02T00:00:00.000Z',
        updatedBy: { id: 'user-1', name: 'User One' },
      },
    ];
    vi.spyOn(BanksUseCase.prototype, 'getBankHistory').mockResolvedValue(mockHistory);

    const controller = new BankHistoryController(context);
    const response = await controller.handleRequest(context);

    expect(response.body.data).toEqual(mockHistory);
  });

  test('should throw ForbiddenError when user lacks SuperUser role', async () => {
    context.session.user.roles = [];

    const controller = new BankHistoryController(context);

    await expect(controller.handleRequest(context)).rejects.toThrow(
      expect.objectContaining({ status: 403 }),
    );
  });
});
