import { vi } from 'vitest';
import MockData from '@common/cams/test-utilities/mock-data';
import { getCamsError } from '../../../common-errors/error-utilities';
import { closeDeferred } from '../../../deferrable/defer-close';
import {
  createMockApplicationContext,
  getTheThrownError,
} from '../../../testing/testing-utilities';
import { ApplicationContext } from '../../types/basic';
import { CaseNotesMongoRepository } from './case-notes.mongo.repository';
import { MongoCollectionAdapter } from './utils/mongo-adapter';
import QueryBuilder from '../../../query/query-builder';
import { CaseNote } from '@common/cams/cases';

const { and, using } = QueryBuilder;
const doc = using<CaseNote>();

describe('case notes repo tests', () => {
  let context: ApplicationContext;
  let repo: CaseNotesMongoRepository;

  beforeEach(async () => {
    context = await createMockApplicationContext();
    repo = CaseNotesMongoRepository.getInstance(context);
  });

  afterEach(async () => {
    await closeDeferred(context);
    vi.restoreAllMocks();
    repo.release();
  });

  describe('test happy paths', () => {
    test('should create note', async () => {
      const noteId = 'note123';
      const expectedNote = MockData.getCaseNote();
      vi.spyOn(MongoCollectionAdapter.prototype, 'insertOne').mockResolvedValue(noteId);
      vi.spyOn(MongoCollectionAdapter.prototype, 'findOne').mockResolvedValue(expectedNote);
      const actual = await repo.create(expectedNote);
      expect(actual).toEqual(expectedNote);
    });

    test('should return notes list when calling getNotesByCaseId', async () => {
      const caseId = '12-12345';
      const mockNotes = [
        MockData.getCaseNote({ caseId }),
        MockData.getCaseNote({ caseId }),
        MockData.getCaseNote({ caseId }),
      ];

      vi.spyOn(MongoCollectionAdapter.prototype, 'find').mockResolvedValue(mockNotes);
      const actualNotes = await repo.getNotesByCaseId(caseId);
      expect(actualNotes).toEqual(mockNotes);
    });

    test('should call updateOne when archiveCaseNote is called.', async () => {
      const archival = MockData.getCaseNoteDeletion();
      const expectedDateParameter = {
        archivedOn: archival.archivedOn,
      };

      const query = and(
        doc('documentType').equals('NOTE'),
        doc('caseId').equals(archival.caseId),
        doc('id').equals(archival.id),
      );

      const updateSpy = vi.spyOn(MongoCollectionAdapter.prototype, 'updateOne').mockResolvedValue({
        matchedCount: 1,
        modifiedCount: 1,
      });

      repo.archiveCaseNote(archival);
      expect(updateSpy).toHaveBeenCalledWith(query, expectedDateParameter);
    });

    test('should call updateOne when update is called', async () => {
      const note = MockData.getCaseNote();
      const input: Partial<CaseNote> = {
        ...note,
        createdOn: note.updatedOn,
        createdBy: note.updatedBy,
      };

      const expectedData = {
        ...input,
      };
      delete expectedData.id;
      delete expectedData.caseId;

      const expectedQuery = and(
        doc('documentType').equals('NOTE'),
        doc('caseId').equals(note.caseId),
        doc('id').equals(note.id),
      );

      const updateOneSpy = vi
        .spyOn(MongoCollectionAdapter.prototype, 'updateOne')
        .mockResolvedValue({ modifiedCount: 1, matchedCount: 1 });

      await repo.update(input);

      expect(updateOneSpy).toHaveBeenCalledWith(expectedQuery, expectedData);
    });

    test('should call findOne', async () => {
      const note = MockData.getCaseNote();
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
      const note = MockData.getCaseNote();
      vi.spyOn(MongoCollectionAdapter.prototype, 'insertOne').mockRejectedValue(error);
      await expect(() => repo.create(note)).rejects.toThrow(
        expect.objectContaining({
          message: 'Unable to create case note.',
          status: 500,
          module: 'CASE-NOTES-MONGO-REPOSITORY',
          originalError: expect.stringContaining('Error: some error'),
        }),
      );
    });

    test('should handle error on archiveNote', async () => {
      const archiveNote = MockData.getCaseNoteDeletion();
      vi.spyOn(MongoCollectionAdapter.prototype, 'updateOne').mockRejectedValue(error);
      await expect(() => repo.archiveCaseNote(archiveNote)).rejects.toThrow(
        expect.objectContaining({
          message: 'Unable to archive case note.',
          status: 500,
          module: 'CASE-NOTES-MONGO-REPOSITORY',
          originalError: expect.stringContaining('Error: some error'),
        }),
      );
    });

    test('should handle error on getNotesByCaseId', async () => {
      const caseId = '12-12345';
      vi.spyOn(MongoCollectionAdapter.prototype, 'find').mockRejectedValue(error);
      await expect(() => repo.getNotesByCaseId(caseId)).rejects.toThrow(
        expect.objectContaining({
          message: 'Unable to retrieve case note.',
          status: 500,
          module: 'CASE-NOTES-MONGO-REPOSITORY',
          originalError: expect.stringContaining('Error: some error'),
        }),
      );
    });

    test('should handle error on update', async () => {
      const archiveNote = MockData.getCaseNote();
      const retrievalErrorMessage = `Failed to update case note ${archiveNote.id}.`;
      const retrievalError = new Error(retrievalErrorMessage);
      vi.spyOn(MongoCollectionAdapter.prototype, 'updateOne').mockRejectedValue(
        getCamsError(
          retrievalError,
          'CASE_NOTES_MONGO_REPOSITORY',
          `Failed to update case note ${archiveNote.id}.`,
        ),
      );
      await expect(() => repo.update(archiveNote)).rejects.toThrow();
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
      // Ensure clean state using public API
      while (CaseNotesMongoRepository['referenceCount'] > 0) {
        await CaseNotesMongoRepository.dropInstance();
      }
      const context1 = await createMockApplicationContext();
      const repo1 = CaseNotesMongoRepository.getInstance(context1);
      expect(repo1).toBeDefined();
      expect(CaseNotesMongoRepository['referenceCount']).toBe(1);
      const context2 = await createMockApplicationContext();
      const repo2 = CaseNotesMongoRepository.getInstance(context2);
      expect(repo2).toBe(repo1); // Should be the same instance
      expect(CaseNotesMongoRepository['referenceCount']).toBe(2);
      // Drop once, should not close
      const closeSpy = vi.spyOn(repo1['client'], 'close').mockResolvedValue();
      CaseNotesMongoRepository.dropInstance();
      expect(CaseNotesMongoRepository['referenceCount']).toBe(1);
      expect(closeSpy).not.toHaveBeenCalled();
      // Drop again, should close and null instance
      CaseNotesMongoRepository.dropInstance();
      expect(CaseNotesMongoRepository['referenceCount']).toBe(0);
      // Wait for close to resolve
      await Promise.resolve();
      expect(closeSpy).toHaveBeenCalled();
      expect(CaseNotesMongoRepository['instance']).toBeNull();
    });

    test('release calls dropInstance', async () => {
      const dropSpy = vi.spyOn(CaseNotesMongoRepository, 'dropInstance');
      repo.release();
      expect(dropSpy).toHaveBeenCalled();
      dropSpy.mockRestore();
    });

    test('getNotesByCaseId returns empty array if no notes', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'find').mockResolvedValue([]);
      const actual = await repo.getNotesByCaseId('some-case-id');
      expect(actual).toEqual([]);
    });

    test('archiveCaseNote with minimal input', async () => {
      const minimal = { caseId: 'case1', id: 'note1', archivedOn: new Date() };
      const expectedQuery = and(
        doc('documentType').equals('NOTE'),
        doc('caseId').equals(minimal.caseId),
        doc('id').equals(minimal.id),
      );
      const expectedDateParameter = { archivedOn: minimal.archivedOn, archivedBy: undefined };
      const updateSpy = vi
        .spyOn(MongoCollectionAdapter.prototype, 'updateOne')
        .mockResolvedValue({ matchedCount: 1, modifiedCount: 1 });
      await repo.archiveCaseNote(minimal);
      expect(updateSpy).toHaveBeenCalledWith(expectedQuery, expectedDateParameter);
    });

    test('update with only caseId and id calls updateOne with empty object', async () => {
      const input = { caseId: 'case1', id: 'note1' };
      const expectedQuery = and(
        doc('documentType').equals('NOTE'),
        doc('caseId').equals(input.caseId),
        doc('id').equals(input.id),
      );
      const updateOneSpy = vi
        .spyOn(MongoCollectionAdapter.prototype, 'updateOne')
        .mockResolvedValue({ modifiedCount: 1, matchedCount: 1 });
      await repo.update({ ...input });
      expect(updateOneSpy).toHaveBeenCalledWith(expectedQuery, {});
    });
  });
});
