import { vi } from 'vitest';
import { ApplicationContext } from '../../adapters/types/basic';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { BanksUseCase } from './banks';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import { BankAuditHistory, BankProfile } from '@common/cams/banks';

describe('BanksUseCase', () => {
  let context: ApplicationContext;
  let useCase: BanksUseCase;

  beforeEach(async () => {
    context = await createMockApplicationContext();
    useCase = new BanksUseCase(context);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getBanks', () => {
    test('should return banks from repository', async () => {
      const mockBanks: BankProfile[] = [
        {
          id: 'bank-1',
          documentType: 'BANK_PROFILE',
          name: 'Alpha Bank',
          status: 'active',
          updatedOn: '2024-01-01T00:00:00.000Z',
          updatedBy: { id: 'user-1', name: 'User One' },
        },
      ];
      vi.spyOn(MockMongoRepository.prototype, 'getBanks').mockResolvedValue(mockBanks);

      const result = await useCase.getBanks();

      expect(result).toEqual(mockBanks);
    });

    test('should wrap repository errors in CamsError', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'getBanks').mockRejectedValue(new Error('db error'));

      await expect(useCase.getBanks()).rejects.toThrow(
        expect.objectContaining({ message: 'Unable to retrieve banks.', status: 500 }),
      );
    });
  });

  describe('getBank', () => {
    test('should return bank by id from repository', async () => {
      const bank: BankProfile = {
        id: 'bank-1',
        documentType: 'BANK_PROFILE',
        name: 'Alpha Bank',
        status: 'active',
        updatedOn: '2024-01-01T00:00:00.000Z',
        updatedBy: { id: 'user-1', name: 'User One' },
      };
      vi.spyOn(MockMongoRepository.prototype, 'getBank').mockResolvedValue(bank);

      const result = await useCase.getBank('bank-1');

      expect(result).toEqual(bank);
    });

    test('should wrap repository errors in CamsError', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'getBank').mockRejectedValue(new Error('not found'));

      await expect(useCase.getBank('bad-id')).rejects.toThrow(
        expect.objectContaining({ message: 'Unable to retrieve bank.', status: 500 }),
      );
    });
  });

  describe('updateBank', () => {
    test('should return updated bank after applying changes', async () => {
      const existing: BankProfile = {
        id: 'bank-1',
        documentType: 'BANK_PROFILE',
        name: 'Alpha Bank',
        status: 'active',
        updatedOn: '2024-01-01T00:00:00.000Z',
        updatedBy: { id: 'user-1', name: 'User One' },
      };
      const updated: BankProfile = {
        ...existing,
        name: 'Alpha Bank Updated',
        status: 'inactive',
        updatedOn: expect.any(String) as unknown as string,
        updatedBy: { id: context.session.user.id, name: context.session.user.name },
      };

      vi.spyOn(MockMongoRepository.prototype, 'getBank').mockResolvedValue(existing);
      vi.spyOn(MockMongoRepository.prototype, 'updateBank').mockResolvedValue(updated);
      vi.spyOn(MockMongoRepository.prototype, 'createBankAuditRecord').mockResolvedValue();

      const result = await useCase.updateBank('bank-1', {
        name: 'Alpha Bank Updated',
        status: 'inactive',
      });

      expect(result.name).toBe('Alpha Bank Updated');
      expect(result.status).toBe('inactive');
      expect(result.updatedBy.id).toBe(context.session.user.id);
    });

    test('should wrap repository errors in CamsError', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'getBank').mockResolvedValue({
        id: 'bank-1',
        documentType: 'BANK_PROFILE',
        name: 'Alpha',
        status: 'active',
        updatedOn: '',
        updatedBy: { id: 'u', name: 'u' },
      });
      vi.spyOn(MockMongoRepository.prototype, 'updateBank').mockRejectedValue(
        new Error('db error'),
      );

      await expect(useCase.updateBank('bank-1', { name: 'New', status: 'active' })).rejects.toThrow(
        expect.objectContaining({ message: 'Unable to update bank.', status: 500 }),
      );
    });
  });

  describe('createBank', () => {
    test('should return created bank with active status and context user attribution', async () => {
      const createdBank: BankProfile = {
        id: 'bank-new',
        documentType: 'BANK_PROFILE',
        name: 'First National',
        status: 'active',
        updatedOn: '2024-01-01T00:00:00.000Z',
        updatedBy: { id: context.session.user.id, name: context.session.user.name },
        createdOn: '2024-01-01T00:00:00.000Z',
        createdBy: { id: context.session.user.id, name: context.session.user.name },
      };

      vi.spyOn(MockMongoRepository.prototype, 'createBank').mockResolvedValue(createdBank);
      vi.spyOn(MockMongoRepository.prototype, 'createBankAuditRecord').mockResolvedValue();

      const result = await useCase.createBank({ name: 'First National' });

      expect(result.name).toBe('First National');
      expect(result.status).toBe('active');
      expect(result.createdBy.id).toBe(context.session.user.id);
      expect(result.updatedBy.id).toBe(context.session.user.id);
    });

    test('should wrap repository errors in CamsError', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'createBank').mockRejectedValue(
        new Error('db error'),
      );

      await expect(useCase.createBank({ name: 'Fail Bank' })).rejects.toThrow(
        expect.objectContaining({ message: 'Unable to create bank.', status: 500 }),
      );
    });
  });

  describe('getBankHistory', () => {
    test('should return history from repository', async () => {
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
      vi.spyOn(MockMongoRepository.prototype, 'getBankHistory').mockResolvedValue(mockHistory);

      const result = await useCase.getBankHistory('bank-1');

      expect(result).toEqual(mockHistory);
    });

    test('should wrap repository errors in CamsError', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'getBankHistory').mockRejectedValue(
        new Error('db error'),
      );

      await expect(useCase.getBankHistory('bank-1')).rejects.toThrow(
        expect.objectContaining({ message: 'Unable to retrieve bank history.', status: 500 }),
      );
    });
  });
});
