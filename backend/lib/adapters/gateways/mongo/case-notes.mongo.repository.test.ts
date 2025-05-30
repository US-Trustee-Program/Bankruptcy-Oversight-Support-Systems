import MockData from '../../../../../common/src/cams/test-utilities/mock-data';
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
import { CaseNote } from '../../../../../common/src/cams/cases';

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
    jest.restoreAllMocks();
    repo.release();
  });

  describe('test happy paths', () => {
    test('should create note', async () => {
      const noteId = 'note123';
      const expectedNote = MockData.getCaseNote();
      jest.spyOn(MongoCollectionAdapter.prototype, 'insertOne').mockResolvedValue(noteId);
      jest.spyOn(MongoCollectionAdapter.prototype, 'findOne').mockResolvedValue(expectedNote);
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

      jest.spyOn(MongoCollectionAdapter.prototype, 'find').mockResolvedValue(mockNotes);
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

      const updateSpy = jest
        .spyOn(MongoCollectionAdapter.prototype, 'updateOne')
        .mockResolvedValue({
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

      const updateOneSpy = jest
        .spyOn(MongoCollectionAdapter.prototype, 'updateOne')
        .mockResolvedValue({ modifiedCount: 1, matchedCount: 1 });

      await repo.update(input);

      expect(updateOneSpy).toHaveBeenCalledWith(expectedQuery, expectedData);
    });

    test('should call findOne', async () => {
      const note = MockData.getCaseNote();
      const findSpy = jest
        .spyOn(MongoCollectionAdapter.prototype, 'findOne')
        .mockResolvedValue(note);

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
      jest.spyOn(MongoCollectionAdapter.prototype, 'insertOne').mockRejectedValue(error);
      await expect(() => repo.create(note)).rejects.toThrow(
        getCamsError(error, 'CASE_NOTES_MONGO_REPOSITORY', 'Unable to create case note.'),
      );
    });

    test('should handle error on archiveNote', async () => {
      const archiveNote = MockData.getCaseNoteDeletion();
      jest.spyOn(MongoCollectionAdapter.prototype, 'updateOne').mockRejectedValue(error);
      await expect(() => repo.archiveCaseNote(archiveNote)).rejects.toThrow(
        getCamsError(error, 'CASE_NOTES_MONGO_REPOSITORY', 'Unable to archive case note.'),
      );
    });

    test('should handle error on getNotesByCaseId', async () => {
      const caseId = '12-12345';
      jest.spyOn(MongoCollectionAdapter.prototype, 'find').mockRejectedValue(error);
      await expect(() => repo.getNotesByCaseId(caseId)).rejects.toThrow(
        getCamsError(error, 'CASE_NOTES_MONGO_REPOSITORY', 'Unable to retrieve case note.'),
      );
    });

    test('should handle error on update', async () => {
      const archiveNote = MockData.getCaseNote();
      const retrievalErrorMessage = `Failed to update case note ${archiveNote.id}.`;
      const retrievalError = new Error(retrievalErrorMessage);
      jest
        .spyOn(MongoCollectionAdapter.prototype, 'updateOne')
        .mockRejectedValue(
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
      jest.spyOn(MongoCollectionAdapter.prototype, 'findOne').mockRejectedValue(originalError);
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
});
