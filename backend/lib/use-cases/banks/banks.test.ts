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

    test('should return empty array when no banks exist', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'getBanks').mockResolvedValue([]);

      const result = await useCase.getBanks();

      expect(result).toEqual([]);
    });
  });

  describe('createBank', () => {
    test('should create bank with status active and write audit record with before:null', async () => {
      const createdBank: BankProfile = {
        id: 'bank-new',
        documentType: 'BANK_PROFILE',
        name: 'First National',
        status: 'active',
        updatedOn: expect.any(String) as unknown as string,
        updatedBy: { id: context.session.user.id, name: context.session.user.name },
        createdOn: expect.any(String) as unknown as string,
        createdBy: { id: context.session.user.id, name: context.session.user.name },
      };

      const createBankSpy = vi
        .spyOn(MockMongoRepository.prototype, 'createBank')
        .mockResolvedValue(createdBank);
      const auditSpy = vi
        .spyOn(MockMongoRepository.prototype, 'createBankAuditRecord')
        .mockResolvedValue();

      const result = await useCase.createBank({ name: 'First National' });

      expect(createBankSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          documentType: 'BANK_PROFILE',
          name: 'First National',
          status: 'active',
        }),
      );

      expect(auditSpy).toHaveBeenCalledWith(
        expect.objectContaining<Partial<BankAuditHistory>>({
          documentType: 'AUDIT_BANK',
          bankId: createdBank.id,
          before: null,
          after: createdBank,
        }),
      );

      expect(result).toEqual(createdBank);
    });

    test('should set createdBy and updatedBy from context user', async () => {
      const createdBank: BankProfile = {
        id: 'bank-new',
        documentType: 'BANK_PROFILE',
        name: 'Test Bank',
        status: 'active',
        updatedOn: '2024-01-01T00:00:00.000Z',
        updatedBy: { id: context.session.user.id, name: context.session.user.name },
        createdOn: '2024-01-01T00:00:00.000Z',
        createdBy: { id: context.session.user.id, name: context.session.user.name },
      };

      const createBankSpy = vi
        .spyOn(MockMongoRepository.prototype, 'createBank')
        .mockResolvedValue(createdBank);
      vi.spyOn(MockMongoRepository.prototype, 'createBankAuditRecord').mockResolvedValue();

      await useCase.createBank({ name: 'Test Bank' });

      expect(createBankSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          createdBy: expect.objectContaining({ id: context.session.user.id }),
          updatedBy: expect.objectContaining({ id: context.session.user.id }),
        }),
      );
    });
  });
});
