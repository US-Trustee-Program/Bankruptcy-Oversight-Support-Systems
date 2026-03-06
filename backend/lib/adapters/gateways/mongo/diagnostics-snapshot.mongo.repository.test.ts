import { vi } from 'vitest';
import { closeDeferred } from '../../../deferrable/defer-close';
import { createMockApplicationContext } from '../../../testing/testing-utilities';
import { ApplicationContext } from '../../types/basic';
import { DiagnosticsSnapshot } from '../../../use-cases/gateways.types';
import { DiagnosticsSnapshotMongoRepository } from './diagnostics-snapshot.mongo.repository';
import { MongoCollectionAdapter } from './utils/mongo-adapter';

const snapshot: DiagnosticsSnapshot = {
  documentType: 'DIAGNOSTICS_SNAPSHOT',
  snapshotDate: '2026-01-01T00:00:00.000Z',
  userCountByRole: { attorney: 3, trustee: 2 },
  oversightUserCount: 5,
};

describe('DiagnosticsSnapshot Mongo Repository', () => {
  let context: ApplicationContext;
  let repo: DiagnosticsSnapshotMongoRepository;

  beforeEach(async () => {
    context = await createMockApplicationContext();
    repo = DiagnosticsSnapshotMongoRepository.getInstance(context);
  });

  afterEach(async () => {
    await closeDeferred(context);
    vi.restoreAllMocks();
    repo.release();
  });

  describe('create', () => {
    test('should insert a diagnostics snapshot', async () => {
      const insertSpy = vi
        .spyOn(MongoCollectionAdapter.prototype, 'insertOne')
        .mockResolvedValue('some-id');
      await repo.create(snapshot);
      expect(insertSpy).toHaveBeenCalledWith(snapshot);
    });

    test('should throw a CamsError when insertOne fails', async () => {
      const error = new Error('insert failed');
      vi.spyOn(MongoCollectionAdapter.prototype, 'insertOne').mockRejectedValue(error);
      await expect(() => repo.create(snapshot)).rejects.toThrow(
        expect.objectContaining({
          message: 'Unable to create diagnostics snapshot.',
          status: 500,
          module: 'DIAGNOSTICS-SNAPSHOT-MONGO-REPOSITORY',
        }),
      );
    });
  });

  describe('singleton and reference-count logic', () => {
    test('getInstance returns the same instance and increments referenceCount', async () => {
      while (DiagnosticsSnapshotMongoRepository['referenceCount'] > 0) {
        DiagnosticsSnapshotMongoRepository.dropInstance();
      }
      const context1 = await createMockApplicationContext();
      const repo1 = DiagnosticsSnapshotMongoRepository.getInstance(context1);
      expect(repo1).toBeDefined();
      expect(DiagnosticsSnapshotMongoRepository['referenceCount']).toBe(1);

      const context2 = await createMockApplicationContext();
      const repo2 = DiagnosticsSnapshotMongoRepository.getInstance(context2);
      expect(repo2).toBe(repo1);
      expect(DiagnosticsSnapshotMongoRepository['referenceCount']).toBe(2);

      const closeSpy = vi.spyOn(repo1['client'], 'close').mockResolvedValue();
      DiagnosticsSnapshotMongoRepository.dropInstance();
      expect(DiagnosticsSnapshotMongoRepository['referenceCount']).toBe(1);
      expect(closeSpy).not.toHaveBeenCalled();

      DiagnosticsSnapshotMongoRepository.dropInstance();
      expect(DiagnosticsSnapshotMongoRepository['referenceCount']).toBe(0);
      await Promise.resolve();
      expect(closeSpy).toHaveBeenCalled();
      expect(DiagnosticsSnapshotMongoRepository['instance']).toBeNull();
    });

    test('release calls dropInstance', () => {
      const dropSpy = vi.spyOn(DiagnosticsSnapshotMongoRepository, 'dropInstance');
      repo.release();
      expect(dropSpy).toHaveBeenCalled();
      dropSpy.mockRestore();
    });
  });
});
