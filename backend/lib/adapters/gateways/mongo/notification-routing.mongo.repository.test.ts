import { vi } from 'vitest';
import { ApplicationContext } from '../../types/basic';
import { NotificationRoutingMongoRepository } from './notification-routing.mongo.repository';
import { NotificationRecipient } from '@common/cams/notifications';
import { createMockApplicationContext } from '../../../testing/testing-utilities';
import { MongoCollectionAdapter } from './utils/mongo-adapter';
import { closeDeferred } from '../../../deferrable/defer-close';
import { NotFoundError } from '../../../common-errors/not-found-error';

const mockFindOne = vi.fn();

describe('NotificationRoutingMongoRepository', () => {
  let context: ApplicationContext;
  let repository: NotificationRoutingMongoRepository;

  beforeEach(async () => {
    mockFindOne.mockReset();
    vi.spyOn(MongoCollectionAdapter.prototype, 'findOne').mockImplementation(mockFindOne);
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
    vi.restoreAllMocks();
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

      await expect(repository.findRecipientByKey('chapter:7')).rejects.toThrow();
    });
  });

  describe('getDefaultRecipient', () => {
    test('returns the default row when seeded', async () => {
      const seeded: NotificationRecipient = {
        key: 'default',
        recipientAddress: 'default@example.test',
        displayName: 'Default Oversight',
      };
      mockFindOne.mockResolvedValue(seeded);

      const result = await repository.getDefaultRecipient();

      expect(result).toEqual(seeded);
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
});
