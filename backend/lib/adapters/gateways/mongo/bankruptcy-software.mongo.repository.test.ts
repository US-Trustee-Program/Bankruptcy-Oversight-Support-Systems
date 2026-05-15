import { vi } from 'vitest';
import { closeDeferred } from '../../../deferrable/defer-close';
import { createMockApplicationContext } from '../../../testing/testing-utilities';
import { ApplicationContext } from '../../types/basic';
import { BankruptcySoftwareMongoRepository } from './bankruptcy-software.mongo.repository';
import { MongoCollectionAdapter } from './utils/mongo-adapter';
import {
  BankruptcySoftwareAuditHistory,
  BankruptcySoftwareProfile,
} from '@common/cams/bankruptcy-software';
import { Creatable } from '@common/cams/creatable';

describe('BankruptcySoftwareMongoRepository', () => {
  let context: ApplicationContext;
  let repo: BankruptcySoftwareMongoRepository;

  beforeEach(async () => {
    context = await createMockApplicationContext();
    repo = BankruptcySoftwareMongoRepository.getInstance(context);
  });

  afterEach(async () => {
    await closeDeferred(context);
    vi.restoreAllMocks();
    repo.release();
  });

  describe('getSoftwareList', () => {
    test('should return all software sorted ascending by name', async () => {
      const mockSoftware: BankruptcySoftwareProfile[] = [
        {
          id: 'sw-1',
          documentType: 'BANKRUPTCY_SOFTWARE',
          name: 'Axos',
          status: 'active',
          updatedOn: '2024-01-01T00:00:00.000Z',
          updatedBy: { id: 'user-1', name: 'User One' },
        },
        {
          id: 'sw-2',
          documentType: 'BANKRUPTCY_SOFTWARE',
          name: 'BlueStylus',
          status: 'active',
          updatedOn: '2024-01-01T00:00:00.000Z',
          updatedBy: { id: 'user-1', name: 'User One' },
        },
      ];
      vi.spyOn(MongoCollectionAdapter.prototype, 'find').mockResolvedValue(mockSoftware);

      const result = await repo.getSoftwareList();

      expect(result).toEqual(mockSoftware);
    });

    test('should return empty array when no software exists', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'find').mockResolvedValue([]);

      const result = await repo.getSoftwareList();

      expect(result).toEqual([]);
    });

    test('should throw CamsError when find fails', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'find').mockRejectedValue(
        new Error('connection error'),
      );

      await expect(repo.getSoftwareList()).rejects.toThrow(
        expect.objectContaining({
          message: 'Unable to retrieve bankruptcy software.',
          status: 500,
          module: 'BANKRUPTCY-SOFTWARE-MONGO-REPOSITORY',
        }),
      );
    });
  });

  describe('createSoftware', () => {
    test('should insert and return the created software', async () => {
      const newId = 'sw-abc';
      const input: Creatable<BankruptcySoftwareProfile> = {
        documentType: 'BANKRUPTCY_SOFTWARE',
        name: 'New Software',
        status: 'active',
        updatedOn: '2024-01-01T00:00:00.000Z',
        updatedBy: { id: 'user-1', name: 'User One' },
        createdOn: '2024-01-01T00:00:00.000Z',
        createdBy: { id: 'user-1', name: 'User One' },
      };
      const expected: BankruptcySoftwareProfile = { ...input, id: newId };

      vi.spyOn(MongoCollectionAdapter.prototype, 'insertOne').mockResolvedValue(newId);
      vi.spyOn(MongoCollectionAdapter.prototype, 'findOne').mockResolvedValue(expected);

      const result = await repo.createSoftware(input);

      expect(result).toEqual(expected);
    });

    test('should throw CamsError when insertOne fails', async () => {
      const input: Creatable<BankruptcySoftwareProfile> = {
        documentType: 'BANKRUPTCY_SOFTWARE',
        name: 'New Software',
        status: 'active',
        updatedOn: '2024-01-01T00:00:00.000Z',
        updatedBy: { id: 'user-1', name: 'User One' },
      };
      vi.spyOn(MongoCollectionAdapter.prototype, 'insertOne').mockRejectedValue(
        new Error('write error'),
      );

      await expect(repo.createSoftware(input)).rejects.toThrow(
        expect.objectContaining({
          message: 'Unable to create bankruptcy software.',
          status: 500,
          module: 'BANKRUPTCY-SOFTWARE-MONGO-REPOSITORY',
        }),
      );
    });
  });

  describe('createSoftwareAuditRecord', () => {
    test('should insert audit record into bankruptcy-software collection', async () => {
      const input: Creatable<BankruptcySoftwareAuditHistory> = {
        documentType: 'AUDIT_BANKRUPTCY_SOFTWARE',
        softwareId: 'sw-abc',
        before: null,
        after: {
          id: 'sw-abc',
          name: 'New Software',
          status: 'active',
          documentType: 'BANKRUPTCY_SOFTWARE',
        },
        updatedOn: '2024-01-01T00:00:00.000Z',
        updatedBy: { id: 'user-1', name: 'User One' },
        createdOn: '2024-01-01T00:00:00.000Z',
        createdBy: { id: 'user-1', name: 'User One' },
      };
      const insertSpy = vi
        .spyOn(MongoCollectionAdapter.prototype, 'insertOne')
        .mockResolvedValue('audit-id-1');

      await repo.createSoftwareAuditRecord(input);

      expect(insertSpy).toHaveBeenCalledWith(input);
    });

    test('should throw CamsError when audit insertOne fails', async () => {
      const input: Creatable<BankruptcySoftwareAuditHistory> = {
        documentType: 'AUDIT_BANKRUPTCY_SOFTWARE',
        softwareId: 'sw-abc',
        before: null,
        after: {
          id: 'sw-abc',
          name: 'New Software',
          status: 'active',
          documentType: 'BANKRUPTCY_SOFTWARE',
        },
        updatedOn: '2024-01-01T00:00:00.000Z',
        updatedBy: { id: 'user-1', name: 'User One' },
      };
      vi.spyOn(MongoCollectionAdapter.prototype, 'insertOne').mockRejectedValue(
        new Error('audit write error'),
      );

      await expect(repo.createSoftwareAuditRecord(input)).rejects.toThrow(
        expect.objectContaining({
          message: 'Unable to create bankruptcy software audit record.',
          status: 500,
          module: 'BANKRUPTCY-SOFTWARE-MONGO-REPOSITORY',
        }),
      );
    });
  });

  describe('findSoftwareById', () => {
    test('should return the software by id', async () => {
      const software: BankruptcySoftwareProfile = {
        id: 'sw-1',
        documentType: 'BANKRUPTCY_SOFTWARE',
        name: 'Axos',
        status: 'active',
        updatedOn: '2024-01-01T00:00:00.000Z',
        updatedBy: { id: 'user-1', name: 'User One' },
      };
      vi.spyOn(MongoCollectionAdapter.prototype, 'findOne').mockResolvedValue(software);

      const result = await repo.findSoftwareById('sw-1');

      expect(result).toEqual(software);
    });

    test('should throw CamsError when findOne fails', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'findOne').mockRejectedValue(
        new Error('not found'),
      );

      await expect(repo.findSoftwareById('sw-1')).rejects.toThrow(
        expect.objectContaining({
          message: 'Unable to retrieve bankruptcy software.',
          status: 500,
          module: 'BANKRUPTCY-SOFTWARE-MONGO-REPOSITORY',
        }),
      );
    });
  });

  describe('updateSoftware', () => {
    test('should replace document and return the updated software', async () => {
      const updated: BankruptcySoftwareProfile = {
        id: 'sw-1',
        documentType: 'BANKRUPTCY_SOFTWARE',
        name: 'Axos Updated',
        status: 'active',
        updatedOn: '2024-01-02T00:00:00.000Z',
        updatedBy: { id: 'user-1', name: 'User One' },
      };
      const replaceSpy = vi
        .spyOn(MongoCollectionAdapter.prototype, 'replaceOne')
        .mockResolvedValue({ id: 'sw-1', modifiedCount: 1, upsertedCount: 0 });

      const result = await repo.updateSoftware('sw-1', updated);

      expect(replaceSpy).toHaveBeenCalled();
      expect(result).toEqual(updated);
    });

    test('should throw CamsError when replaceOne fails', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'replaceOne').mockRejectedValue(
        new Error('write error'),
      );

      await expect(
        repo.updateSoftware('sw-1', {
          id: 'sw-1',
          documentType: 'BANKRUPTCY_SOFTWARE',
          name: 'Axos',
          status: 'active',
          updatedOn: '2024-01-01T00:00:00.000Z',
          updatedBy: { id: 'user-1', name: 'User One' },
        }),
      ).rejects.toThrow(
        expect.objectContaining({
          message: 'Unable to update bankruptcy software.',
          status: 500,
          module: 'BANKRUPTCY-SOFTWARE-MONGO-REPOSITORY',
        }),
      );
    });
  });

  describe('singleton lifecycle', () => {
    test('should return same instance on multiple getInstance calls', async () => {
      const context2 = await createMockApplicationContext();
      const repo2 = BankruptcySoftwareMongoRepository.getInstance(context2);
      expect(repo2).toBe(repo);
      repo2.release();
    });

    test('release calls dropInstance', () => {
      const dropSpy = vi.spyOn(BankruptcySoftwareMongoRepository, 'dropInstance');
      repo.release();
      expect(dropSpy).toHaveBeenCalled();
      dropSpy.mockRestore();
    });
  });
});
