import { vi } from 'vitest';
import { closeDeferred } from '../../../deferrable/defer-close';
import {
  createMockApplicationContext,
  getTheThrownError,
} from '../../../testing/testing-utilities';
import { ApplicationContext } from '../../types/basic';
import { TrusteeUpcomingKeyDatesMongoRepository } from './trustee-upcoming-key-dates.mongo.repository';
import { MongoCollectionAdapter } from './utils/mongo-adapter';
import QueryBuilder from '../../../query/query-builder';
import {
  TrusteeUpcomingKeyDates,
  TrusteeUpcomingKeyDatesHistory,
} from '@common/cams/trustee-upcoming-key-dates';
import { SYSTEM_USER_REFERENCE } from '@common/cams/auditable';
import { Creatable } from '@common/cams/creatable';

const { and, using } = QueryBuilder;
const doc = using<TrusteeUpcomingKeyDates>();

function buildMockDocument(
  overrides: Partial<TrusteeUpcomingKeyDates> = {},
): TrusteeUpcomingKeyDates {
  return {
    id: 'test-id-001',
    documentType: 'TRUSTEE_UPCOMING_REPORT_DATES',
    trusteeId: 'trustee-001',
    appointmentId: 'appointment-001',
    createdBy: SYSTEM_USER_REFERENCE,
    createdOn: '2026-01-01T00:00:00.000Z',
    updatedBy: SYSTEM_USER_REFERENCE,
    updatedOn: '2026-01-01T00:00:00.000Z',
    pastFieldExam: '2026-03-15',
    ...overrides,
  };
}

describe('TrusteeUpcomingKeyDatesMongoRepository', () => {
  let context: ApplicationContext;
  let repo: TrusteeUpcomingKeyDatesMongoRepository;

  beforeEach(async () => {
    context = await createMockApplicationContext();
    repo = TrusteeUpcomingKeyDatesMongoRepository.getInstance(context);
  });

  afterEach(async () => {
    await closeDeferred(context);
    vi.restoreAllMocks();
    repo.release();
  });

  describe('getByAppointmentId', () => {
    test('returns document when found', async () => {
      const mockDoc = buildMockDocument();
      const expectedQuery = and(
        doc('documentType').equals('TRUSTEE_UPCOMING_REPORT_DATES'),
        doc('appointmentId').equals(mockDoc.appointmentId),
      );
      const findOneSpy = vi
        .spyOn(MongoCollectionAdapter.prototype, 'findOne')
        .mockResolvedValue(mockDoc);

      const result = await repo.getByAppointmentId(mockDoc.appointmentId);

      expect(result).toEqual(mockDoc);
      expect(findOneSpy).toHaveBeenCalledWith(expectedQuery);
    });

    test('throws CamsError when findOne fails', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'findOne').mockRejectedValue(
        new Error('Database connection failed'),
      );

      await expect(repo.getByAppointmentId('nonexistent-appointment')).rejects.toThrow(
        'Unable to fetch upcoming key dates for appointment nonexistent-appointment.',
      );
    });
  });

  describe('read', () => {
    test('returns document by id', async () => {
      const mockDoc = buildMockDocument();
      const expectedQuery = and(
        doc('documentType').equals('TRUSTEE_UPCOMING_REPORT_DATES'),
        doc('id').equals(mockDoc.id),
      );
      const findOneSpy = vi
        .spyOn(MongoCollectionAdapter.prototype, 'findOne')
        .mockResolvedValue(mockDoc);

      const result = await repo.read(mockDoc.id);

      expect(result).toEqual(mockDoc);
      expect(findOneSpy).toHaveBeenCalledWith(expectedQuery);
    });

    test('throws CamsError when read fails', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'findOne').mockRejectedValue(
        new Error('DB error'),
      );

      const actual = await getTheThrownError(async () => {
        await repo.read('bad-id');
      });

      expect(actual).toMatchObject({
        module: MODULE_NAME,
        isCamsError: true,
      });
    });
  });

  describe('upsert', () => {
    test('calls replaceOne with upsert=true', async () => {
      const mockDoc = buildMockDocument();
      const replaceOneSpy = vi
        .spyOn(MongoCollectionAdapter.prototype, 'replaceOne')
        .mockResolvedValue({ id: mockDoc.id, modifiedCount: 1, upsertedCount: 0 });

      await repo.upsert(mockDoc);

      expect(replaceOneSpy).toHaveBeenCalledWith(expect.anything(), mockDoc, true);
    });

    test('throws CamsError when upsert fails', async () => {
      const mockDoc = buildMockDocument();
      vi.spyOn(MongoCollectionAdapter.prototype, 'replaceOne').mockRejectedValue(
        new Error('DB error'),
      );

      const actual = await getTheThrownError(async () => {
        await repo.upsert(mockDoc);
      });

      expect(actual).toMatchObject({
        module: MODULE_NAME,
        isCamsError: true,
      });
    });
  });

  describe('createHistory', () => {
    test('calls insertOne with useProvidedId: true', async () => {
      const history: Creatable<TrusteeUpcomingKeyDatesHistory> = {
        documentType: 'AUDIT_UPCOMING_REPORT_DATES',
        trusteeId: 'trustee-001',
        appointmentId: 'appointment-001',
        before: { pastFieldExam: '2026-01-15' },
        after: { pastFieldExam: '2026-03-15' },
        createdBy: SYSTEM_USER_REFERENCE,
        createdOn: '2026-01-01T00:00:00.000Z',
        updatedBy: SYSTEM_USER_REFERENCE,
        updatedOn: '2026-01-01T00:00:00.000Z',
      };
      const insertOneSpy = vi
        .spyOn(MongoCollectionAdapter.prototype, 'insertOne')
        .mockResolvedValue('new-history-id');

      await repo.createHistory(history);

      expect(insertOneSpy).toHaveBeenCalledWith(history, { useProvidedId: true });
    });

    test('throws CamsError when insertOne fails', async () => {
      const history: Creatable<TrusteeUpcomingKeyDatesHistory> = {
        documentType: 'AUDIT_UPCOMING_REPORT_DATES',
        trusteeId: 'trustee-001',
        appointmentId: 'appointment-001',
        before: {},
        after: {},
        createdBy: SYSTEM_USER_REFERENCE,
        createdOn: '2026-01-01T00:00:00.000Z',
        updatedBy: SYSTEM_USER_REFERENCE,
        updatedOn: '2026-01-01T00:00:00.000Z',
      };
      vi.spyOn(MongoCollectionAdapter.prototype, 'insertOne').mockRejectedValue(
        new Error('DB error'),
      );

      const actual = await getTheThrownError(async () => {
        await repo.createHistory(history);
      });

      expect(actual).toMatchObject({
        module: MODULE_NAME,
        isCamsError: true,
      });
    });
  });

  describe('singleton lifecycle', () => {
    test('getInstance returns same instance and increments referenceCount', async () => {
      while (TrusteeUpcomingKeyDatesMongoRepository['referenceCount'] > 0) {
        TrusteeUpcomingKeyDatesMongoRepository.dropInstance();
      }
      const context1 = await createMockApplicationContext();
      const repo1 = TrusteeUpcomingKeyDatesMongoRepository.getInstance(context1);
      expect(repo1).toBeDefined();
      expect(TrusteeUpcomingKeyDatesMongoRepository['referenceCount']).toBe(1);

      const context2 = await createMockApplicationContext();
      const repo2 = TrusteeUpcomingKeyDatesMongoRepository.getInstance(context2);
      expect(repo2).toBe(repo1);
      expect(TrusteeUpcomingKeyDatesMongoRepository['referenceCount']).toBe(2);

      const closeSpy = vi.spyOn(repo1['client'], 'close').mockResolvedValue();
      TrusteeUpcomingKeyDatesMongoRepository.dropInstance();
      expect(TrusteeUpcomingKeyDatesMongoRepository['referenceCount']).toBe(1);
      expect(closeSpy).not.toHaveBeenCalled();

      TrusteeUpcomingKeyDatesMongoRepository.dropInstance();
      expect(TrusteeUpcomingKeyDatesMongoRepository['referenceCount']).toBe(0);
      await Promise.resolve();
      expect(closeSpy).toHaveBeenCalled();
      expect(TrusteeUpcomingKeyDatesMongoRepository['instance']).toBeNull();
    });

    test('release calls dropInstance', async () => {
      const dropSpy = vi.spyOn(TrusteeUpcomingKeyDatesMongoRepository, 'dropInstance');
      repo.release();
      expect(dropSpy).toHaveBeenCalled();
      dropSpy.mockRestore();
    });
  });
});

const MODULE_NAME = 'TRUSTEE-UPCOMING-KEY-DATES-MONGO-REPOSITORY';
