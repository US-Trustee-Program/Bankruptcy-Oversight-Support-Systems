import { vi } from 'vitest';
import { ApplicationContext } from '../../types/basic';
import { NotificationRoutingMongoRepository } from './notification-routing.mongo.repository';
import {
  NotificationConfig,
  NotificationRecipient,
  NotificationRoutingInput,
  NotificationRoutingRecord,
} from '@common/cams/notifications';
import { createMockApplicationContext } from '../../../testing/testing-utilities';
import { MongoCollectionAdapter } from './utils/mongo-adapter';
import { closeDeferred } from '../../../deferrable/defer-close';
import { NotFoundError } from '../../../common-errors/not-found-error';
import { CamsError } from '../../../common-errors/cams-error';

const mockFindOne = vi.fn();
const mockFind = vi.fn();
const mockInsertOne = vi.fn();
const mockReplaceOne = vi.fn();
const mockDeleteOne = vi.fn();

describe('NotificationRoutingMongoRepository', () => {
  let context: ApplicationContext;
  let repository: NotificationRoutingMongoRepository;

  beforeEach(async () => {
    vi.restoreAllMocks();
    mockFindOne.mockReset();
    mockFind.mockReset();
    mockInsertOne.mockReset();
    mockReplaceOne.mockReset();
    mockDeleteOne.mockReset();
    vi.spyOn(MongoCollectionAdapter.prototype, 'findOne').mockImplementation(mockFindOne);
    vi.spyOn(MongoCollectionAdapter.prototype, 'find').mockImplementation(mockFind);
    vi.spyOn(MongoCollectionAdapter.prototype, 'insertOne').mockImplementation(mockInsertOne);
    vi.spyOn(MongoCollectionAdapter.prototype, 'replaceOne').mockImplementation(mockReplaceOne);
    vi.spyOn(MongoCollectionAdapter.prototype, 'deleteOne').mockImplementation(mockDeleteOne);
    context = await createMockApplicationContext({
      env: {
        MONGO_CONNECTION_STRING: 'mongodb://localhost:27017',
        COSMOS_DATABASE_NAME: 'test-database',
      },
    });
    repository = new NotificationRoutingMongoRepository(context);
  });

  afterEach(async () => {
    await closeDeferred(context);
    repository.release();
  });

  afterAll(() => {
    NotificationRoutingMongoRepository.dropInstance();
  });

  describe('getInstance', () => {
    test('should return the same instance when called multiple times', () => {
      const instance1 = NotificationRoutingMongoRepository.getInstance(context);
      const instance2 = NotificationRoutingMongoRepository.getInstance(context);

      expect(instance1).toBe(instance2);
    });

    test('should create a new instance when none exists', () => {
      NotificationRoutingMongoRepository.dropInstance();

      const instance = NotificationRoutingMongoRepository.getInstance(context);

      expect(instance).toBeInstanceOf(NotificationRoutingMongoRepository);
    });
  });

  describe('release', () => {
    test('should call dropInstance', () => {
      const dropInstanceSpy = vi.spyOn(NotificationRoutingMongoRepository, 'dropInstance');

      repository.release();

      expect(dropInstanceSpy).toHaveBeenCalled();
    });
  });

  describe('findRecipientByKey', () => {
    test('returns the seeded recipient when found', async () => {
      const seeded: NotificationRecipient = {
        key: 'chapter:7',
        recipientAddress: 'ch7@example.test',
        displayName: 'CH7 Oversight',
      };
      mockFindOne.mockResolvedValue(seeded);

      const result = await repository.findRecipientByKey('chapter:7');

      expect(result).toEqual(seeded);
      expect(mockFindOne).toHaveBeenCalledTimes(1);
    });

    test('returns null when adapter throws NotFoundError', async () => {
      mockFindOne.mockRejectedValue(
        new NotFoundError('NOTIFICATION-ROUTING-MONGO-REPOSITORY', {
          message: 'No matching item found.',
        }),
      );

      const result = await repository.findRecipientByKey('missing-key');

      expect(result).toBeNull();
    });

    test('rethrows non-NotFound errors as a CamsError', async () => {
      mockFindOne.mockRejectedValue(new Error('connection refused'));

      await expect(repository.findRecipientByKey('chapter:7')).rejects.toThrow(CamsError);
    });
  });

  describe('getDefaultRecipient', () => {
    test('queries for the default key and returns the matching recipient', async () => {
      const defaultRecipient: NotificationRecipient = {
        key: 'default',
        recipientAddress: 'default@example.test',
        displayName: 'Default Oversight',
      };
      mockFindOne.mockResolvedValue(defaultRecipient);

      const result = await repository.getDefaultRecipient();

      expect(mockFindOne).toHaveBeenCalledTimes(1);
      expect(result).toEqual(defaultRecipient);
    });

    test('throws NotFoundError when the default row is missing', async () => {
      mockFindOne.mockRejectedValue(
        new NotFoundError('NOTIFICATION-ROUTING-MONGO-REPOSITORY', {
          message: 'No matching item found.',
        }),
      );

      await expect(repository.getDefaultRecipient()).rejects.toThrow(NotFoundError);
      await expect(repository.getDefaultRecipient()).rejects.toThrow(
        'Notification routing default recipient is not seeded.',
      );
    });
  });

  describe('getAll', () => {
    test('returns all notification routing records', async () => {
      const records: NotificationRoutingRecord[] = [
        {
          id: 'rec-1',
          documentType: 'NOTIFICATION_ROUTING',
          key: 'chapter:7',
          recipientAddress: 'ch7@example.test',
          displayName: 'CH7 Team',
        },
        {
          id: 'rec-2',
          documentType: 'NOTIFICATION_ROUTING',
          key: 'chapter:11',
          recipientAddress: 'ch11@example.test',
        },
      ];
      mockFind.mockResolvedValue(records);

      const result = await repository.getAll();

      expect(result).toEqual(records);
      expect(mockFind).toHaveBeenCalledTimes(1);
    });

    test('returns empty array when no records exist', async () => {
      mockFind.mockResolvedValue([]);

      const result = await repository.getAll();

      expect(result).toEqual([]);
    });

    test('rethrows errors as CamsError', async () => {
      mockFind.mockRejectedValue(new Error('connection refused'));

      await expect(repository.getAll()).rejects.toThrow(CamsError);
    });
  });

  describe('create', () => {
    test('inserts a new routing record and returns it with id and documentType', async () => {
      const input: NotificationRoutingInput = {
        key: 'chapter:13',
        recipientAddress: 'ch13@example.test',
        displayName: 'CH13 Team',
      };
      const generatedId = 'generated-uuid';
      mockInsertOne.mockResolvedValue(generatedId);

      const result = await repository.create(input);

      expect(result).toEqual({
        id: generatedId,
        documentType: 'NOTIFICATION_ROUTING',
        ...input,
      });
      expect(mockInsertOne).toHaveBeenCalledTimes(1);
    });

    test('rethrows errors as CamsError', async () => {
      const input: NotificationRoutingInput = {
        key: 'chapter:13',
        recipientAddress: 'ch13@example.test',
      };
      mockInsertOne.mockRejectedValue(new Error('insert failed'));

      await expect(repository.create(input)).rejects.toThrow(CamsError);
    });
  });

  describe('update', () => {
    test('replaces an existing routing record by id and returns the updated record', async () => {
      const input: NotificationRoutingInput = {
        key: 'chapter:7',
        recipientAddress: 'updated@example.test',
        displayName: 'Updated Team',
      };
      const id = 'rec-1';
      mockReplaceOne.mockResolvedValue({ id, modifiedCount: 1, upsertedCount: 0 });

      const result = await repository.update(id, input);

      expect(result).toEqual({
        id,
        documentType: 'NOTIFICATION_ROUTING',
        ...input,
      });
      expect(mockReplaceOne).toHaveBeenCalledTimes(1);
    });

    test('rethrows errors as CamsError', async () => {
      const input: NotificationRoutingInput = {
        key: 'chapter:7',
        recipientAddress: 'updated@example.test',
      };
      mockReplaceOne.mockRejectedValue(new Error('replace failed'));

      await expect(repository.update('rec-1', input)).rejects.toThrow(CamsError);
    });
  });

  describe('delete', () => {
    test('deletes the routing record by id', async () => {
      mockDeleteOne.mockResolvedValue(1);

      await expect(repository.delete('rec-1')).resolves.toBeUndefined();
      expect(mockDeleteOne).toHaveBeenCalledTimes(1);
    });

    test('rethrows errors as CamsError', async () => {
      mockDeleteOne.mockRejectedValue(new Error('delete failed'));

      await expect(repository.delete('rec-1')).rejects.toThrow(CamsError);
    });
  });

  describe('getConfig', () => {
    test('returns the notification config when it exists', async () => {
      const configDoc = { documentType: 'NOTIFICATION_CONFIG', enabled: true };
      mockFindOne.mockResolvedValue(configDoc);

      const result = await repository.getConfig();

      expect(result).toEqual({ enabled: true });
    });

    test('returns default config (enabled: false) when no config document exists', async () => {
      mockFindOne.mockRejectedValue(
        new NotFoundError('NOTIFICATION-ROUTING-MONGO-REPOSITORY', {
          message: 'No matching item found.',
        }),
      );

      const result = await repository.getConfig();

      expect(result).toEqual({ enabled: false });
    });

    test('rethrows non-NotFound errors as CamsError', async () => {
      mockFindOne.mockRejectedValue(new Error('connection refused'));

      await expect(repository.getConfig()).rejects.toThrow(CamsError);
    });
  });

  describe('updateConfig', () => {
    test('upserts the notification config and returns it', async () => {
      const config: NotificationConfig = { enabled: true };
      mockReplaceOne.mockResolvedValue({ id: 'config-id', modifiedCount: 1, upsertedCount: 0 });

      const result = await repository.updateConfig(config);

      expect(result).toEqual(config);
      expect(mockReplaceOne).toHaveBeenCalledTimes(1);
    });

    test('rethrows errors as CamsError', async () => {
      const config: NotificationConfig = { enabled: false };
      mockReplaceOne.mockRejectedValue(new Error('replace failed'));

      await expect(repository.updateConfig(config)).rejects.toThrow(CamsError);
    });
  });
});
