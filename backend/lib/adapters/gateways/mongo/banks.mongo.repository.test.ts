import { vi } from 'vitest';
import { closeDeferred } from '../../../deferrable/defer-close';
import { createMockApplicationContext } from '../../../testing/testing-utilities';
import { ApplicationContext } from '../../types/basic';
import { BanksMongoRepository } from './banks.mongo.repository';
import { MongoCollectionAdapter } from './utils/mongo-adapter';
import { BankAuditHistory, BankProfile } from '@common/cams/banks';
import { Creatable } from '@common/cams/creatable';

describe('BanksMongoRepository', () => {
  let context: ApplicationContext;
  let repo: BanksMongoRepository;

  beforeEach(async () => {
    context = await createMockApplicationContext();
    repo = BanksMongoRepository.getInstance(context);
  });

  afterEach(async () => {
    await closeDeferred(context);
    vi.restoreAllMocks();
    repo.release();
  });

  describe('getBanks', () => {
    test('should return all banks sorted ascending by name', async () => {
      const mockBanks: BankProfile[] = [
        {
          id: 'bank-1',
          documentType: 'BANK_PROFILE',
          name: 'Alpha Bank',
          status: 'active',
          updatedOn: '2024-01-01T00:00:00.000Z',
          updatedBy: { id: 'user-1', name: 'User One' },
        },
        {
          id: 'bank-2',
          documentType: 'BANK_PROFILE',
          name: 'Beta Bank',
          status: 'inactive',
          updatedOn: '2024-01-01T00:00:00.000Z',
          updatedBy: { id: 'user-1', name: 'User One' },
        },
      ];
      vi.spyOn(MongoCollectionAdapter.prototype, 'find').mockResolvedValue(mockBanks);

      const result = await repo.getBanks();

      expect(result).toEqual(mockBanks);
    });

    test('should return empty array when no banks exist', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'find').mockResolvedValue([]);

      const result = await repo.getBanks();

      expect(result).toEqual([]);
    });

    test('should throw CamsError when find fails', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'find').mockRejectedValue(
        new Error('connection error'),
      );

      await expect(repo.getBanks()).rejects.toThrow(
        expect.objectContaining({
          message: 'Unable to retrieve banks.',
          status: 500,
          module: 'BANKS-MONGO-REPOSITORY',
        }),
      );
    });
  });

  describe('createBank', () => {
    test('should insert and return the created bank', async () => {
      const newId = 'bank-abc';
      const input: Creatable<BankProfile> = {
        documentType: 'BANK_PROFILE',
        name: 'New Bank',
        status: 'active',
        updatedOn: '2024-01-01T00:00:00.000Z',
        updatedBy: { id: 'user-1', name: 'User One' },
        createdOn: '2024-01-01T00:00:00.000Z',
        createdBy: { id: 'user-1', name: 'User One' },
      };
      const expected: BankProfile = { ...input, id: newId };

      vi.spyOn(MongoCollectionAdapter.prototype, 'insertOne').mockResolvedValue(newId);
      vi.spyOn(MongoCollectionAdapter.prototype, 'findOne').mockResolvedValue(expected);

      const result = await repo.createBank(input);

      expect(result).toEqual(expected);
    });

    test('should throw CamsError when insertOne fails', async () => {
      const input: Creatable<BankProfile> = {
        documentType: 'BANK_PROFILE',
        name: 'New Bank',
        status: 'active',
        updatedOn: '2024-01-01T00:00:00.000Z',
        updatedBy: { id: 'user-1', name: 'User One' },
      };
      vi.spyOn(MongoCollectionAdapter.prototype, 'insertOne').mockRejectedValue(
        new Error('write error'),
      );

      await expect(repo.createBank(input)).rejects.toThrow(
        expect.objectContaining({
          message: 'Unable to create bank.',
          status: 500,
          module: 'BANKS-MONGO-REPOSITORY',
        }),
      );
    });
  });

  describe('createBankAuditRecord', () => {
    test('should insert audit record into banks collection', async () => {
      const input: Creatable<BankAuditHistory> = {
        documentType: 'AUDIT_BANK',
        bankId: 'bank-abc',
        before: null,
        after: { id: 'bank-abc', name: 'New Bank', status: 'active', documentType: 'BANK_PROFILE' },
        updatedOn: '2024-01-01T00:00:00.000Z',
        updatedBy: { id: 'user-1', name: 'User One' },
        createdOn: '2024-01-01T00:00:00.000Z',
        createdBy: { id: 'user-1', name: 'User One' },
      };
      const insertSpy = vi
        .spyOn(MongoCollectionAdapter.prototype, 'insertOne')
        .mockResolvedValue('audit-id-1');

      await repo.createBankAuditRecord(input);

      expect(insertSpy).toHaveBeenCalledWith(input);
    });

    test('should throw CamsError when audit insertOne fails', async () => {
      const input: Creatable<BankAuditHistory> = {
        documentType: 'AUDIT_BANK',
        bankId: 'bank-abc',
        before: null,
        after: { id: 'bank-abc', name: 'New Bank', status: 'active', documentType: 'BANK_PROFILE' },
        updatedOn: '2024-01-01T00:00:00.000Z',
        updatedBy: { id: 'user-1', name: 'User One' },
      };
      vi.spyOn(MongoCollectionAdapter.prototype, 'insertOne').mockRejectedValue(
        new Error('audit write error'),
      );

      await expect(repo.createBankAuditRecord(input)).rejects.toThrow(
        expect.objectContaining({
          message: 'Unable to create bank audit record.',
          status: 500,
          module: 'BANKS-MONGO-REPOSITORY',
        }),
      );
    });
  });

  describe('getBank', () => {
    test('should return bank by id', async () => {
      const bank: BankProfile = {
        id: 'bank-1',
        documentType: 'BANK_PROFILE',
        name: 'Alpha Bank',
        status: 'active',
        updatedOn: '2024-01-01T00:00:00.000Z',
        updatedBy: { id: 'user-1', name: 'User One' },
      };
      vi.spyOn(MongoCollectionAdapter.prototype, 'findOne').mockResolvedValue(bank);

      const result = await repo.getBank('bank-1');

      expect(result).toEqual(bank);
    });

    test('should throw CamsError when findOne fails', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'findOne').mockRejectedValue(
        new Error('not found'),
      );

      await expect(repo.getBank('bad-id')).rejects.toThrow(
        expect.objectContaining({
          message: 'Unable to retrieve bank.',
          status: 500,
          module: 'BANKS-MONGO-REPOSITORY',
        }),
      );
    });
  });

  describe('updateBank', () => {
    test('should replace bank document and return updated bank', async () => {
      const updated: BankProfile = {
        id: 'bank-1',
        documentType: 'BANK_PROFILE',
        name: 'Alpha Bank Updated',
        status: 'inactive',
        updatedOn: '2024-01-02T00:00:00.000Z',
        updatedBy: { id: 'user-1', name: 'User One' },
      };
      vi.spyOn(MongoCollectionAdapter.prototype, 'replaceOne').mockResolvedValue({
        id: 'bank-1',
        modifiedCount: 1,
        upsertedCount: 0,
      });
      vi.spyOn(MongoCollectionAdapter.prototype, 'findOne').mockResolvedValue(updated);

      const result = await repo.updateBank('bank-1', updated);

      expect(result).toEqual(updated);
    });

    test('should throw CamsError when replaceOne fails', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'replaceOne').mockRejectedValue(
        new Error('write error'),
      );

      await expect(
        repo.updateBank('bank-1', {
          id: 'bank-1',
          documentType: 'BANK_PROFILE',
          name: 'X',
          status: 'active',
          updatedOn: '',
          updatedBy: { id: 'u', name: 'u' },
        }),
      ).rejects.toThrow(
        expect.objectContaining({
          message: 'Unable to update bank.',
          status: 500,
          module: 'BANKS-MONGO-REPOSITORY',
        }),
      );
    });
  });

  describe('singleton lifecycle', () => {
    test('should return same instance on multiple getInstance calls', async () => {
      const context2 = await createMockApplicationContext();
      const repo2 = BanksMongoRepository.getInstance(context2);
      expect(repo2).toBe(repo);
      repo2.release();
    });

    test('release calls dropInstance', () => {
      const dropSpy = vi.spyOn(BanksMongoRepository, 'dropInstance');
      repo.release();
      expect(dropSpy).toHaveBeenCalled();
      dropSpy.mockRestore();
    });
  });
});
