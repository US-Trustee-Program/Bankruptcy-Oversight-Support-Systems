import { MockData } from '../../../../common/src/cams/test-utilities/mock-data';
import {
  createMockApplicationContext,
  createMockApplicationContextSession,
} from '../../testing/testing-utilities';
import { CamsRole } from '../../../../common/src/cams/roles';
import { REGION_02_GROUP_NY } from '../../../../common/src/cams/test-utilities/mock-user';
import { ApplicationContext } from '../../adapters/types/basic';
import { CaseNotesUseCase } from '../../use-cases/case-notes/case-notes';
import { CaseNotesController } from './case.notes.controller';
import { mockCamsHttpRequest } from '../../testing/mock-data/cams-http-request-helper';
import { NORMAL_CASE_ID } from '../../testing/testing-constants';
import { getCamsError } from '../../common-errors/error-utilities';
import { randomUUID } from 'crypto';

describe('Case note controller tests', () => {
  let applicationContext: ApplicationContext;

  const user = {
    ...MockData.getCamsUserReference(),
    name: 'Mock Name',
    offices: [REGION_02_GROUP_NY],
    roles: [CamsRole.CaseAssignmentManager],
  };

  beforeEach(async () => {
    applicationContext = await createMockApplicationContext();
    applicationContext.session = await createMockApplicationContextSession({ user });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('should call createCaseNote on a case if POST request and valid note', async () => {
    const createSpy = jest.spyOn(CaseNotesUseCase.prototype, 'createCaseNote').mockResolvedValue();

    const mockCase = MockData.getCaseBasics();
    applicationContext.request = mockCamsHttpRequest({
      method: 'POST',
      params: {
        id: mockCase.caseId,
      },
      body: {
        title: 'test note title',
        content: 'some test string',
      },
    });
    const controller = new CaseNotesController(applicationContext);
    await controller.handleRequest(applicationContext);

    expect(createSpy).toHaveBeenCalled();
  });

  test('should call getCaseNotes for a case if GET', async () => {
    const caseNotes = [MockData.getCaseNote()];
    const getSpy = jest
      .spyOn(CaseNotesUseCase.prototype, 'getCaseNotes')
      .mockResolvedValue(caseNotes);
    const mockCase = MockData.getCaseBasics({ override: { caseId: caseNotes[0].caseId } });
    applicationContext.request = mockCamsHttpRequest({
      method: 'GET',
      params: {
        id: mockCase.caseId,
      },
    });
    const controller = new CaseNotesController(applicationContext);
    await controller.handleRequest(applicationContext);

    expect(getSpy).toHaveBeenCalled();
  });

  test('should throw error when no caseId is provided', async () => {
    jest.spyOn(CaseNotesUseCase.prototype, 'createCaseNote').mockResolvedValue();
    applicationContext.request = mockCamsHttpRequest({
      method: 'POST',
      params: {
        caseId: '',
      },
      body: {},
    });
    const controller = new CaseNotesController(applicationContext);
    await expect(controller.handleRequest(applicationContext)).rejects.toThrow(
      'Required parameters caseId, case note title, case note content are absent.',
    );
  });

  test('should throw error when malformed caseId is provided', async () => {
    jest.spyOn(CaseNotesUseCase.prototype, 'createCaseNote').mockResolvedValue();
    applicationContext.request = mockCamsHttpRequest({
      method: 'POST',
      params: {
        id: 'n-1f23',
      },
      body: {},
    });
    const controller = new CaseNotesController(applicationContext);
    await expect(controller.handleRequest(applicationContext)).rejects.toThrow(
      'caseId must be formatted like 111-01-12345.',
    );
  });

  test('should throw error when empty case note is provided', async () => {
    jest.spyOn(CaseNotesUseCase.prototype, 'createCaseNote').mockResolvedValue();

    applicationContext.request = mockCamsHttpRequest({
      method: 'POST',
      params: {
        id: NORMAL_CASE_ID,
      },
      body: {},
    });
    const controller = new CaseNotesController(applicationContext);
    await expect(controller.handleRequest(applicationContext)).rejects.toThrow(
      'Required parameters case note title, case note content are absent.',
    );
  });

  test('should throw error when no case note title is provided', async () => {
    jest.spyOn(CaseNotesUseCase.prototype, 'createCaseNote').mockResolvedValue();

    applicationContext.request = mockCamsHttpRequest({
      method: 'POST',
      params: {
        id: NORMAL_CASE_ID,
      },
      body: {
        content: 'test note content',
      },
    });
    const controller = new CaseNotesController(applicationContext);
    await expect(controller.handleRequest(applicationContext)).rejects.toThrow(
      'Required parameter case note title is absent.',
    );
  });

  test('should throw error when no case note content is provided', async () => {
    jest.spyOn(CaseNotesUseCase.prototype, 'createCaseNote').mockResolvedValue();

    applicationContext.request = mockCamsHttpRequest({
      method: 'POST',
      params: {
        id: NORMAL_CASE_ID,
      },
      body: {
        title: 'test note title',
      },
    });
    const controller = new CaseNotesController(applicationContext);
    await expect(controller.handleRequest(applicationContext)).rejects.toThrow(
      'Required parameter case note content is absent.',
    );
  });

  const maliciousNote = "fetch('/api/data');";

  test('should throw error when XSS note content is provided', async () => {
    jest.spyOn(CaseNotesUseCase.prototype, 'createCaseNote').mockResolvedValue();
    applicationContext.request = mockCamsHttpRequest({
      method: 'POST',
      params: {
        id: NORMAL_CASE_ID,
      },
      body: {
        title: 'test note title',
        content: maliciousNote,
      },
    });

    const controller = new CaseNotesController(applicationContext);
    await expect(controller.handleRequest(applicationContext)).rejects.toThrow(
      'Note content contains invalid keywords.',
    );
  });

  const testMongoInjectedNotes = 'mongo.aggregate([{ key: 1 }]);';

  test('should throw error when malicious mongo note content is provided', async () => {
    jest.spyOn(CaseNotesUseCase.prototype, 'createCaseNote').mockResolvedValue();
    applicationContext.request = mockCamsHttpRequest({
      method: 'POST',
      params: {
        id: NORMAL_CASE_ID,
      },
      body: {
        title: 'test note title',
        content: testMongoInjectedNotes,
      },
    });

    const controller = new CaseNotesController(applicationContext);
    await expect(controller.handleRequest(applicationContext)).rejects.toThrow(
      'Note content contains invalid keywords.',
    );
  });

  test('should throw error when XSS note title is provided', async () => {
    jest.spyOn(CaseNotesUseCase.prototype, 'createCaseNote').mockResolvedValue();
    applicationContext.request = mockCamsHttpRequest({
      method: 'POST',
      params: {
        id: NORMAL_CASE_ID,
      },
      body: {
        title: maliciousNote,
        content: 'some test content.',
      },
    });

    const controller = new CaseNotesController(applicationContext);
    await expect(controller.handleRequest(applicationContext)).rejects.toThrow(
      'Note title contains invalid keywords.',
    );
  });

  test('should throw error when malicious mongo note title is provided', async () => {
    jest.spyOn(CaseNotesUseCase.prototype, 'createCaseNote').mockResolvedValue();
    applicationContext.request = mockCamsHttpRequest({
      method: 'POST',
      params: {
        id: NORMAL_CASE_ID,
      },
      body: {
        title: testMongoInjectedNotes,
        content: 'some test content.',
      },
    });

    const controller = new CaseNotesController(applicationContext);
    await expect(controller.handleRequest(applicationContext)).rejects.toThrow(
      'Note title contains invalid keywords.',
    );
  });

  test('should handle errors thrown from useCase', async () => {
    const error = new Error('Case notes test error');
    jest.spyOn(CaseNotesUseCase.prototype, 'getCaseNotes').mockRejectedValue(error);
    applicationContext.request = mockCamsHttpRequest({
      method: 'GET',
      params: {
        caseId: NORMAL_CASE_ID,
      },
    });
    const expectedCamsError = getCamsError(error, 'CASE-NOTES-CONTROLLER');
    const controller = new CaseNotesController(applicationContext);
    await expect(controller.handleRequest(applicationContext)).rejects.toThrow(expectedCamsError);
  });

  test('should call archiveCaseNote if PATCH request', async () => {
    const archiveNote = MockData.getCaseNoteArchival({ id: randomUUID() });
    const archiveSpy = jest
      .spyOn(CaseNotesUseCase.prototype, 'archiveCaseNote')
      .mockResolvedValue({ id: archiveNote.id, matchedCount: 1, modifiedCount: 1 });

    delete archiveNote.archiveDate;

    applicationContext.request = mockCamsHttpRequest({
      method: 'PATCH',
      params: {
        id: archiveNote.caseId,
      },
      body: {
        id: archiveNote.id,
        caseId: archiveNote.caseId,
      },
    });
    const controller = new CaseNotesController(applicationContext);
    await controller.handleRequest(applicationContext);
    expect(archiveSpy).toHaveBeenCalledWith(archiveNote);
  });

  test('should throw error when updateCaseNote throws an error', async () => {
    const archiveNote = MockData.getCaseNoteArchival({ id: randomUUID() });
    const error = new Error('Case notes test error');
    const expectedCamsError = getCamsError(error, 'CASE-NOTES-CONTROLLER');
    jest.spyOn(CaseNotesUseCase.prototype, 'archiveCaseNote').mockRejectedValue(error);

    applicationContext.request = mockCamsHttpRequest({
      method: 'PATCH',
      params: {
        caseId: archiveNote.caseId,
      },
      body: {
        id: archiveNote.id,
        caseId: archiveNote.caseId,
      },
    });
    const controller = new CaseNotesController(applicationContext);
    await expect(controller.handleRequest(applicationContext)).rejects.toThrow(expectedCamsError);
  });
});
