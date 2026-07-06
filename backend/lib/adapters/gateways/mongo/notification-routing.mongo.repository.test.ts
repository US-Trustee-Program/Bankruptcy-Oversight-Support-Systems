import { vi } from 'vitest';
import { ApplicationContext } from '../../types/basic';
import { NotificationRoutingMongoRepository } from './notification-routing.mongo.repository';
import {
  NotificationRoutingRecord,
  NotificationRoutingUpdateInput,
} from '@common/cams/notifications';
import { createMockApplicationContext } from '../../../testing/testing-utilities';
import { MongoCollectionAdapter } from './utils/mongo-adapter';
import { closeDeferred } from '../../../deferrable/defer-close';
import { NotFoundError } from '../../../common-errors/not-found-error';
import { CamsError } from '../../../common-errors/cams-error';

const mockFindOne = vi.fn();
const mockFind = vi.fn();
const mockReplaceOne = vi.fn();

describe('NotificationRoutingMongoRepository', () => {
  let context: ApplicationContext;
  let repository: NotificationRoutingMongoRepository;

  beforeEach(async () => {
    vi.restoreAllMocks();
    mockFindOne.mockReset();
    mockFind.mockReset();
    mockReplaceOne.mockReset();
    vi.spyOn(MongoCollectionAdapter.prototype, 'findOne').mockImplementation(mockFindOne);
    vi.spyOn(MongoCollectionAdapter.prototype, 'find').mockImplementation(mockFind);
    vi.spyOn(MongoCollectionAdapter.prototype, 'replaceOne').mockImplementation(mockReplaceOne);
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

  describe('findRecipientByRoutingKey', () => {
    test('returns the recipient when a record covers the given key', async () => {
      const doc = {
        covers: ['chapter:7'],
        recipientAddresses: ['ch-oversight@example.test'],
        displayName: 'Chapter 7 Oversight',
      };
      mockFindOne.mockResolvedValue(doc);

      const result = await repository.findRecipientByRoutingKey('chapter:7');

      expect(result).toEqual({
        covers: doc.covers,
        recipientAddresses: doc.recipientAddresses,
        displayName: doc.displayName,
      });
      expect(mockFindOne).toHaveBeenCalledTimes(1);
      const query = mockFindOne.mock.calls[0][0];
      expect(query).toEqual({
        condition: 'CONTAINS',
        leftOperand: { name: 'covers' },
        rightOperand: ['chapter:7'],
      });
    });

    test('defaults missing fields to empty values', async () => {
      mockFindOne.mockResolvedValue({});

      const result = await repository.findRecipientByRoutingKey('chapter:7');

      expect(result).toEqual({
        covers: [],
        recipientAddresses: [],
        displayName: '',
      });
    });

    test('coerces legacy recipientAddress string to recipientAddresses array', async () => {
      mockFindOne.mockResolvedValue({
        covers: ['chapter:7'],
        recipientAddress: 'legacy@example.test',
        displayName: 'Legacy Record',
      });

      const result = await repository.findRecipientByRoutingKey('chapter:7');

      expect(result?.recipientAddresses).toEqual(['legacy@example.test']);
    });

    test('returns null when no record covers the given key', async () => {
      mockFindOne.mockRejectedValue(
        new NotFoundError('NOTIFICATION-ROUTING-MONGO-REPOSITORY', {
          message: 'No matching item found.',
        }),
      );

      const result = await repository.findRecipientByRoutingKey('missing-key');

      expect(result).toBeNull();
    });

    test('rethrows non-NotFound errors as a CamsError', async () => {
      mockFindOne.mockRejectedValue(new Error('connection refused'));

      await expect(repository.findRecipientByRoutingKey('chapter:7')).rejects.toThrow(CamsError);
    });
  });

  describe('getAll', () => {
    test('returns all notification routing records', async () => {
      const records: NotificationRoutingRecord[] = [
        {
          id: 'chapter-7-oversight',
          documentType: 'NOTIFICATION_ROUTING',
          covers: ['chapter:7'],
          recipientAddresses: ['ch-oversight@example.test'],
          displayName: 'Chapter 7 Oversight',
        },
        {
          id: 'subchapter-v-oversight',
          documentType: 'NOTIFICATION_ROUTING',
          covers: ['chapter:11-subchapter-v'],
          recipientAddresses: ['subv@example.test'],
          displayName: 'Chapter 11 Subchapter V',
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

  describe('update', () => {
    test('upserts the routing record preserving covers and displayName from definitions', async () => {
      const input: NotificationRoutingUpdateInput = {
        recipientAddresses: ['updated@example.test'],
      };
      const id = 'chapter-7-oversight';
      mockReplaceOne.mockResolvedValue({ id, modifiedCount: 1, upsertedCount: 0 });

      const result = await repository.updateRoutingRecord(id, input);

      expect(result).toEqual({
        id,
        documentType: 'NOTIFICATION_ROUTING',
        covers: ['chapter:7'],
        recipientAddresses: ['updated@example.test'],
        displayName: 'Chapter 7 Oversight',
      });
      expect(mockReplaceOne).toHaveBeenCalledTimes(1);
    });

    test('stores multiple addresses', async () => {
      const input: NotificationRoutingUpdateInput = {
        recipientAddresses: ['primary@example.test', 'backup@example.test'],
      };
      const id = 'chapter-7-oversight';
      mockReplaceOne.mockResolvedValue({ id, modifiedCount: 1, upsertedCount: 0 });

      const result = await repository.updateRoutingRecord(id, input);

      expect(result.recipientAddresses).toEqual(['primary@example.test', 'backup@example.test']);
    });

    test('defaults covers and displayName to empty when id is not in definitions', async () => {
      const input: NotificationRoutingUpdateInput = {
        recipientAddresses: ['unknown@example.test'],
      };
      const id = 'unknown-id';
      mockReplaceOne.mockResolvedValue({ id, modifiedCount: 0, upsertedCount: 1 });

      const result = await repository.updateRoutingRecord(id, input);

      expect(result).toEqual({
        id,
        documentType: 'NOTIFICATION_ROUTING',
        covers: [],
        recipientAddresses: ['unknown@example.test'],
        displayName: '',
      });
    });

    test('rethrows errors as CamsError', async () => {
      const input: NotificationRoutingUpdateInput = {
        recipientAddresses: ['updated@example.test'],
      };
      mockReplaceOne.mockRejectedValue(new Error('replace failed'));

      await expect(repository.updateRoutingRecord('chapter-7-oversight', input)).rejects.toThrow(
        CamsError,
      );
    });
  });
});
