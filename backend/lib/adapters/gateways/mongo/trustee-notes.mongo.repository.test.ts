import { vi } from 'vitest';
import MockData from '@common/cams/test-utilities/mock-data';
import { getCamsError } from '../../../common-errors/error-utilities';
import { closeDeferred } from '../../../deferrable/defer-close';
import {
  createMockApplicationContext,
  getTheThrownError,
} from '../../../testing/testing-utilities';
import { ApplicationContext } from '../../types/basic';
import { TrusteeNotesMongoRepository } from './trustee-notes.mongo.repository';
import { MongoCollectionAdapter } from './utils/mongo-adapter';
import QueryBuilder from '../../../query/query-builder';
import { TrusteeNote } from '@common/cams/trustee-notes';

const { and, using } = QueryBuilder;
const doc = using<TrusteeNote>();

describe('trustee notes repo tests', () => {
  let context: ApplicationContext;
  let repo: TrusteeNotesMongoRepository;

  beforeEach(async () => {
    context = await createMockApplicationContext();
    repo = TrusteeNotesMongoRepository.getInstance(context);
  });

  afterEach(async () => {
    await closeDeferred(context);
    vi.restoreAllMocks();
    repo.release();
  });

  describe('test happy paths', () => {
    test('should create note', async () => {
      const noteId = 'note123';
      const expectedNote = MockData.getTrusteeNote();
      vi.spyOn(MongoCollectionAdapter.prototype, 'insertOne').mockResolvedValue(noteId);
      vi.spyOn(MongoCollectionAdapter.prototype, 'findOne').mockResolvedValue(expectedNote);
      const actual = await repo.create(expectedNote);
      expect(actual).toEqual(expectedNote);
    });

    test('should return notes list when calling getNotesByTrusteeId', async () => {
      const trusteeId = 'trustee-uuid-1234';
      const mockNotes = [
        MockData.getTrusteeNote({ trusteeId }),
        MockData.getTrusteeNote({ trusteeId }),
        MockData.getTrusteeNote({ trusteeId }),
      ];

      vi.spyOn(MongoCollectionAdapter.prototype, 'find').mockResolvedValue(mockNotes);
      const actualNotes = await repo.getNotesByTrusteeId(trusteeId);
      expect(actualNotes).toEqual(mockNotes);
    });

    test('should call updateOne when archiveTrusteeNote is called', async () => {
      const archival = MockData.getTrusteeNoteDeletion();
      const expectedDateParameter = {
        archivedOn: archival.archivedOn,
        archivedBy: archival.archivedBy,
      };

      const query = and(
        doc('documentType').equals('TRUSTEE_NOTE'),
        doc('trusteeId').equals(archival.trusteeId),
        doc('id').equals(archival.id),
      );

      const updateSpy = vi.spyOn(MongoCollectionAdapter.prototype, 'updateOne').mockResolvedValue({
        matchedCount: 1,
        modifiedCount: 1,
      });

      repo.archiveTrusteeNote(archival);
      expect(updateSpy).toHaveBeenCalledWith(query, expectedDateParameter);
    });

    test('should call updateOne when update is called', async () => {
      const note = MockData.getTrusteeNote();
      const input: Partial<TrusteeNote> = {
        ...note,
        createdOn: note.updatedOn,
        createdBy: note.updatedBy,
      };

      const expectedData = { ...input };
      delete expectedData.id;
      delete expectedData.trusteeId;

      const expectedQuery = and(
        doc('documentType').equals('TRUSTEE_NOTE'),
        doc('trusteeId').equals(note.trusteeId),
        doc('id').equals(note.id),
      );

      const updateOneSpy = vi
        .spyOn(MongoCollectionAdapter.prototype, 'updateOne')
        .mockResolvedValue({ modifiedCount: 1, matchedCount: 1 });

      await repo.update(input);

      expect(updateOneSpy).toHaveBeenCalledWith(expectedQuery, expectedData);
    });

    test('should call findOne when read is called', async () => {
      const note = MockData.getTrusteeNote();
      const findSpy = vi.spyOn(MongoCollectionAdapter.prototype, 'findOne').mockResolvedValue(note);

      const query = doc('id').equals(note.id);

      const actual = await repo.read(note.id);
      expect(actual).toEqual(note);
      expect(findSpy).toHaveBeenCalledWith(query);
    });
  });

  describe('handle errors', () => {
    const error = new Error('some error');

    test('should handle error on create note', async () => {
      const note = MockData.getTrusteeNote();
      vi.spyOn(MongoCollectionAdapter.prototype, 'insertOne').mockRejectedValue(error);
      await expect(() => repo.create(note)).rejects.toThrow(
        expect.objectContaining({
          message: 'Unable to create trustee note.',
          status: 500,
          module: 'TRUSTEE-NOTES-MONGO-REPOSITORY',
          originalError: expect.stringContaining('Error: some error'),
        }),
      );
    });

    test('should handle error on archiveTrusteeNote', async () => {
      const archiveNote = MockData.getTrusteeNoteDeletion();
      vi.spyOn(MongoCollectionAdapter.prototype, 'updateOne').mockRejectedValue(error);
      await expect(() => repo.archiveTrusteeNote(archiveNote)).rejects.toThrow(
        expect.objectContaining({
          message: 'Unable to archive trustee note.',
          status: 500,
          module: 'TRUSTEE-NOTES-MONGO-REPOSITORY',
          originalError: expect.stringContaining('Error: some error'),
        }),
      );
    });

    test('should handle error on getNotesByTrusteeId', async () => {
      const trusteeId = 'trustee-uuid-1234';
      vi.spyOn(MongoCollectionAdapter.prototype, 'find').mockRejectedValue(error);
      await expect(() => repo.getNotesByTrusteeId(trusteeId)).rejects.toThrow(
        expect.objectContaining({
          message: 'Unable to retrieve trustee notes.',
          status: 500,
          module: 'TRUSTEE-NOTES-MONGO-REPOSITORY',
          originalError: expect.stringContaining('Error: some error'),
        }),
      );
    });

    test('should handle error on update', async () => {
      const note = MockData.getTrusteeNote();
      const retrievalErrorMessage = `Failed to update trustee note ${note.id}.`;
      const retrievalError = new Error(retrievalErrorMessage);
      vi.spyOn(MongoCollectionAdapter.prototype, 'updateOne').mockRejectedValue(
        getCamsError(
          retrievalError,
          'TRUSTEE_NOTES_MONGO_REPOSITORY',
          `Failed to update trustee note ${note.id}.`,
        ),
      );
      await expect(() => repo.update(note)).rejects.toThrow();
    });

    test('should handle error on read', async () => {
      const originalError = new Error('some error');
      vi.spyOn(MongoCollectionAdapter.prototype, 'findOne').mockRejectedValue(originalError);
      const actual = await getTheThrownError(async () => {
        await repo.read('some-id');
      });
      const expected = {
        message: 'Unknown Error',
        module: expect.any(String),
        originalError: expect.anything(),
        isCamsError: true,
        camsStack: expect.anything(),
        data: undefined,
        status: 500,
      };
      expect(actual).toEqual(expected);
    });
  });

  describe('branch and singleton logic', () => {
    test('singleton getInstance and dropInstance logic', async () => {
      while (TrusteeNotesMongoRepository['referenceCount'] > 0) {
        await TrusteeNotesMongoRepository.dropInstance();
      }
      const context1 = await createMockApplicationContext();
      const repo1 = TrusteeNotesMongoRepository.getInstance(context1);
      expect(repo1).toBeDefined();
      expect(TrusteeNotesMongoRepository['referenceCount']).toBe(1);
      const context2 = await createMockApplicationContext();
      const repo2 = TrusteeNotesMongoRepository.getInstance(context2);
      expect(repo2).toBe(repo1);
      expect(TrusteeNotesMongoRepository['referenceCount']).toBe(2);
      const closeSpy = vi.spyOn(repo1['client'], 'close').mockResolvedValue();
      TrusteeNotesMongoRepository.dropInstance();
      expect(TrusteeNotesMongoRepository['referenceCount']).toBe(1);
      expect(closeSpy).not.toHaveBeenCalled();
      TrusteeNotesMongoRepository.dropInstance();
      expect(TrusteeNotesMongoRepository['referenceCount']).toBe(0);
      await Promise.resolve();
      expect(closeSpy).toHaveBeenCalled();
      expect(TrusteeNotesMongoRepository['instance']).toBeNull();
    });

    test('release calls dropInstance', async () => {
      const dropSpy = vi.spyOn(TrusteeNotesMongoRepository, 'dropInstance');
      repo.release();
      expect(dropSpy).toHaveBeenCalled();
      dropSpy.mockRestore();
    });

    test('getNotesByTrusteeId returns empty array if no notes', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'find').mockResolvedValue([]);
      const actual = await repo.getNotesByTrusteeId('some-trustee-id');
      expect(actual).toEqual([]);
    });
  });
});
