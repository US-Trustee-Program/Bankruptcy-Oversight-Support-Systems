import MockData from '../../../../../common/src/cams/test-utilities/mock-data';
import { getCamsError } from '../../../common-errors/error-utilities';
import { closeDeferred } from '../../../deferrable/defer-close';
import { createMockApplicationContext } from '../../../testing/testing-utilities';
import { ApplicationContext } from '../../types/basic';
import { CaseNotesMongoRepository } from './case-notes.mongo.repository';
import { MongoCollectionAdapter } from './utils/mongo-adapter';

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
      const note = MockData.getCaseNote();
      jest.spyOn(MongoCollectionAdapter.prototype, 'insertOne').mockResolvedValue(noteId);
      const actual = await repo.create(note);
      expect(actual).toEqual(noteId);
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

    test('should handle error on getNotesByCaseId', async () => {
      const caseId = '12-12345';
      jest.spyOn(MongoCollectionAdapter.prototype, 'find').mockRejectedValue(error);
      await expect(() => repo.getNotesByCaseId(caseId)).rejects.toThrow(
        getCamsError(error, 'CASE_NOTES_MONGO_REPOSITORY', 'Unable to retrieve case note.'),
      );
    });
  });
});
