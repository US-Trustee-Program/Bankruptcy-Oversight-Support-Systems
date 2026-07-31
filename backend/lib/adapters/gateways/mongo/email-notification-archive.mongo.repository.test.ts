import { vi } from 'vitest';
import { ApplicationContext } from '../../types/basic';
import { EmailNotificationArchiveMongoRepository } from './email-notification-archive.mongo.repository';
import { EmailNotificationArchiveRecord } from '../../../use-cases/gateways.types';
import { TrusteeChangeSet } from '@common/cams/notifications';
import { createMockApplicationContext } from '../../../testing/testing-utilities';
import { MongoCollectionAdapter } from './utils/mongo-adapter';
import { closeDeferred } from '../../../deferrable/defer-close';
import { NotFoundError } from '../../../common-errors/not-found-error';
import { CamsError } from '../../../common-errors/cams-error';

const mockFindOne = vi.fn();
const mockInsertOne = vi.fn();

function buildChangeSet(overrides: Partial<TrusteeChangeSet> = {}): TrusteeChangeSet {
  return {
    trusteeId: 'trustee-1',
    trusteeName: 'Henry Green',
    fields: [
      {
        label: 'Public Contact',
        comparisons: [{ before: 'old@example.test', after: 'new@example.test' }],
        category: 'profile',
        section: 'appointment',
      },
    ],
    chapters: ['7'],
    ...overrides,
  };
}

describe('EmailNotificationArchiveMongoRepository', () => {
  let context: ApplicationContext;
  let repository: EmailNotificationArchiveMongoRepository;

  beforeEach(async () => {
    vi.restoreAllMocks();
    mockFindOne.mockReset();
    mockInsertOne.mockReset();
    vi.spyOn(MongoCollectionAdapter.prototype, 'findOne').mockImplementation(mockFindOne);
    vi.spyOn(MongoCollectionAdapter.prototype, 'insertOne').mockImplementation(mockInsertOne);
    context = await createMockApplicationContext({
      env: {
        MONGO_CONNECTION_STRING: 'mongodb://localhost:27017',
        COSMOS_DATABASE_NAME: 'test-database',
      },
    });
    repository = new EmailNotificationArchiveMongoRepository(context);
  });

  afterEach(async () => {
    await closeDeferred(context);
    repository.release();
  });

  afterAll(() => {
    EmailNotificationArchiveMongoRepository.dropInstance();
  });

  describe('getInstance', () => {
    test('should return the same instance when called multiple times', () => {
      const instance1 = EmailNotificationArchiveMongoRepository.getInstance(context);
      const instance2 = EmailNotificationArchiveMongoRepository.getInstance(context);

      expect(instance1).toBe(instance2);
    });

    test('should create a new instance when none exists', () => {
      EmailNotificationArchiveMongoRepository.dropInstance();

      const instance = EmailNotificationArchiveMongoRepository.getInstance(context);

      expect(instance).toBeInstanceOf(EmailNotificationArchiveMongoRepository);
    });
  });

  describe('release', () => {
    test('should call dropInstance', () => {
      const dropInstanceSpy = vi.spyOn(EmailNotificationArchiveMongoRepository, 'dropInstance');

      repository.release();

      expect(dropInstanceSpy).toHaveBeenCalled();
    });
  });

  describe('archiveSentEmail', () => {
    test('inserts a document with the record fields plus a ttl', async () => {
      const record: EmailNotificationArchiveRecord = {
        messageId: 'msg-1',
        recipientAddress: 'ch-oversight@example.test',
        changeSet: buildChangeSet(),
      };
      mockInsertOne.mockResolvedValue({ id: 'msg-1' });

      await repository.archiveSentEmail(record);

      expect(mockInsertOne).toHaveBeenCalledTimes(1);
      const insertedDoc = mockInsertOne.mock.calls[0][0];
      expect(insertedDoc).toEqual({
        ...record,
        ttl: 60 * 60 * 24 * 7,
      });
    });

    test('rethrows errors as CamsError', async () => {
      const record: EmailNotificationArchiveRecord = {
        messageId: 'msg-1',
        recipientAddress: 'ch-oversight@example.test',
        changeSet: buildChangeSet(),
      };
      mockInsertOne.mockRejectedValue(new Error('connection refused'));

      await expect(repository.archiveSentEmail(record)).rejects.toThrow(CamsError);
    });
  });

  describe('readArchivedEmail', () => {
    test('returns the record without the ttl field when found', async () => {
      const changeSet = buildChangeSet();
      mockFindOne.mockResolvedValue({
        messageId: 'msg-1',
        recipientAddress: 'ch-oversight@example.test',
        changeSet,
        ttl: 604_800,
      });

      const result = await repository.readArchivedEmail('msg-1');

      expect(result).toEqual({
        messageId: 'msg-1',
        recipientAddress: 'ch-oversight@example.test',
        changeSet,
      });
      expect(mockFindOne).toHaveBeenCalledTimes(1);
      const query = mockFindOne.mock.calls[0][0];
      expect(query).toEqual({
        condition: 'EQUALS',
        leftOperand: { name: 'messageId' },
        rightOperand: 'msg-1',
      });
    });

    test('returns null when no record matches (e.g. already TTL-expired)', async () => {
      mockFindOne.mockRejectedValue(
        new NotFoundError('EMAIL-NOTIFICATION-ARCHIVE-MONGO-REPOSITORY', {
          message: 'No matching item found.',
        }),
      );

      const result = await repository.readArchivedEmail('missing-message-id');

      expect(result).toBeNull();
    });

    test('rethrows non-NotFound errors as a CamsError', async () => {
      mockFindOne.mockRejectedValue(new Error('connection refused'));

      await expect(repository.readArchivedEmail('msg-1')).rejects.toThrow(CamsError);
    });
  });
});
