import { randomUUID } from 'crypto';

import { CaseNoteDeleteRequest, CaseNoteInput } from '../../../../common/src/cams/cases';
import { CamsRole } from '../../../../common/src/cams/roles';
import { getCamsUserReference } from '../../../../common/src/cams/session';
import { MockData } from '../../../../common/src/cams/test-utilities/mock-data';
import { REGION_02_GROUP_NY } from '../../../../common/src/cams/test-utilities/mock-user';
import { ApplicationContext } from '../../adapters/types/basic';
import { getCamsError } from '../../common-errors/error-utilities';
import { mockCamsHttpRequest } from '../../testing/mock-data/cams-http-request-helper';
import { NORMAL_CASE_ID } from '../../testing/testing-constants';
import {
  createMockApplicationContext,
  createMockApplicationContextSession,
} from '../../testing/testing-utilities';
import { CaseNotesUseCase } from '../../use-cases/case-notes/case-notes';
import { CaseNotesController } from './case.notes.controller';

describe('Case note controller tests', () => {
  let applicationContext: ApplicationContext<CaseNoteInput>;

  const user = {
    ...MockData.getCamsUserReference(),
    name: 'Mock Name',
    offices: [REGION_02_GROUP_NY],
    roles: [CamsRole.CaseAssignmentManager],
  };

  beforeEach(async () => {
    applicationContext = await createMockApplicationContext<CaseNoteInput>();
    applicationContext.session = await createMockApplicationContextSession({ user });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('should call createCaseNote on a case if POST request and valid note', async () => {
    const createSpy = jest.spyOn(CaseNotesUseCase.prototype, 'createCaseNote').mockResolvedValue();

    const mockCase = MockData.getCaseBasics();
    const body: CaseNoteInput = {
      caseId: mockCase.caseId,
      content: 'some test string',
      title: 'test note title',
    };

    applicationContext.request = mockCamsHttpRequest({
      body,
      method: 'POST',
      params: {
        caseId: mockCase.caseId,
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
        caseId: mockCase.caseId,
      },
    });
    const controller = new CaseNotesController(applicationContext);
    await controller.handleRequest(applicationContext);

    expect(getSpy).toHaveBeenCalled();
  });

  test('should throw error when no caseId is provided', async () => {
    jest.spyOn(CaseNotesUseCase.prototype, 'createCaseNote').mockResolvedValue();
    applicationContext.request = mockCamsHttpRequest({
      body: {
        caseId: undefined,
        content: undefined,
        title: undefined,
      },
      method: 'POST',
      params: {
        caseId: '',
      },
    });
    const controller = new CaseNotesController(applicationContext);
    await expect(controller.handleRequest(applicationContext)).rejects.toThrow(
      'Required parameters caseId, case note title, case note content are absent.',
    );
  });

  test('should throw error when malformed caseId is provided', async () => {
    jest.spyOn(CaseNotesUseCase.prototype, 'createCaseNote').mockResolvedValue();
    applicationContext.request = mockCamsHttpRequest<CaseNoteInput>({
      body: {
        caseId: undefined,
        content: undefined,
        title: undefined,
      },
      method: 'POST',
      params: {
        caseId: 'n-1f23',
      },
    });
    const controller = new CaseNotesController(applicationContext);
    await expect(controller.handleRequest(applicationContext)).rejects.toThrow(
      'caseId must be formatted like 111-01-12345.',
    );
  });

  test('should throw error when empty case note is provided', async () => {
    jest.spyOn(CaseNotesUseCase.prototype, 'createCaseNote').mockResolvedValue();

    applicationContext.request = mockCamsHttpRequest<CaseNoteInput>({
      body: {
        caseId: undefined,
        content: undefined,
        title: undefined,
      },
      method: 'POST',
      params: {
        caseId: NORMAL_CASE_ID,
      },
    });
    const controller = new CaseNotesController(applicationContext);
    await expect(controller.handleRequest(applicationContext)).rejects.toThrow(
      'Required parameters case note title, case note content are absent.',
    );
  });

  test('should throw error when no case note title is provided', async () => {
    jest.spyOn(CaseNotesUseCase.prototype, 'createCaseNote').mockResolvedValue();

    applicationContext.request = mockCamsHttpRequest<CaseNoteInput>({
      body: {
        caseId: NORMAL_CASE_ID,
        content: 'test note content',
        title: undefined,
      },
      method: 'POST',
      params: {
        caseId: NORMAL_CASE_ID,
      },
    });
    const controller = new CaseNotesController(applicationContext);
    await expect(controller.handleRequest(applicationContext)).rejects.toThrow(
      'Required parameter case note title is absent.',
    );
  });

  test('should throw error when no case note content is provided', async () => {
    jest.spyOn(CaseNotesUseCase.prototype, 'createCaseNote').mockResolvedValue();

    applicationContext.request = mockCamsHttpRequest<CaseNoteInput>({
      body: {
        caseId: NORMAL_CASE_ID,
        content: undefined,
        title: 'test note title',
      },
      method: 'POST',
      params: {
        caseId: NORMAL_CASE_ID,
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
    applicationContext.request = mockCamsHttpRequest<CaseNoteInput>({
      body: {
        caseId: NORMAL_CASE_ID,
        content: maliciousNote,
        title: 'test note title',
      },
      method: 'POST',
      params: {
        caseId: NORMAL_CASE_ID,
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
    applicationContext.request = mockCamsHttpRequest<CaseNoteInput>({
      body: {
        caseId: NORMAL_CASE_ID,
        content: testMongoInjectedNotes,
        title: 'test note title',
      },
      method: 'POST',
      params: {
        caseId: NORMAL_CASE_ID,
      },
    });

    const controller = new CaseNotesController(applicationContext);
    await expect(controller.handleRequest(applicationContext)).rejects.toThrow(
      'Note content contains invalid keywords.',
    );
  });

  test('should throw error when XSS note title is provided', async () => {
    jest.spyOn(CaseNotesUseCase.prototype, 'createCaseNote').mockResolvedValue();
    applicationContext.request = mockCamsHttpRequest<CaseNoteInput>({
      body: {
        caseId: NORMAL_CASE_ID,
        content: 'some test content.',
        title: maliciousNote,
      },
      method: 'POST',
      params: {
        caseId: NORMAL_CASE_ID,
      },
    });

    const controller = new CaseNotesController(applicationContext);
    await expect(controller.handleRequest(applicationContext)).rejects.toThrow(
      'Note title contains invalid keywords.',
    );
  });

  test('should throw error when malicious mongo note title is provided', async () => {
    jest.spyOn(CaseNotesUseCase.prototype, 'createCaseNote').mockResolvedValue();
    applicationContext.request = mockCamsHttpRequest<CaseNoteInput>({
      body: {
        caseId: NORMAL_CASE_ID,
        content: 'some test content.',
        title: testMongoInjectedNotes,
      },
      method: 'POST',
      params: {
        caseId: NORMAL_CASE_ID,
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

  test('should call archiveCaseNote if DELETE request', async () => {
    const archiveNote = MockData.getCaseNoteDeletion({ id: randomUUID() });
    const archiveSpy = jest
      .spyOn(CaseNotesUseCase.prototype, 'archiveCaseNote')
      .mockResolvedValue({ matchedCount: 1, modifiedCount: 1 });
    const expectedRequest: CaseNoteDeleteRequest = {
      caseId: archiveNote.caseId,
      id: archiveNote.id,
      sessionUser: applicationContext.session.user,
    };

    applicationContext.request = mockCamsHttpRequest({
      method: 'DELETE',
      params: {
        caseId: archiveNote.caseId,
        noteId: archiveNote.id,
      },
    });
    const controller = new CaseNotesController(applicationContext);
    await controller.handleRequest(applicationContext);
    expect(archiveSpy).toHaveBeenCalledWith(expectedRequest);
  });

  test('should throw error when updateCaseNote throws an error', async () => {
    const archiveNote = MockData.getCaseNoteDeletion({ id: randomUUID() });
    const error = new Error('Case notes test error');
    const expectedCamsError = getCamsError(error, 'CASE-NOTES-CONTROLLER');
    jest.spyOn(CaseNotesUseCase.prototype, 'archiveCaseNote').mockRejectedValue(error);

    applicationContext.request = mockCamsHttpRequest({
      method: 'DELETE',
      params: {
        caseId: archiveNote.caseId,
        noteId: archiveNote.id,
        userId: archiveNote.updatedBy.id,
      },
    });
    const controller = new CaseNotesController(applicationContext);
    await expect(controller.handleRequest(applicationContext)).rejects.toThrow(expectedCamsError);
  });

  const goodCaseNote = MockData.getCaseNote({ updatedBy: user });
  const testParams = [
    ['noteId', undefined, goodCaseNote.caseId, goodCaseNote.updatedBy.id],
    ['noteId', '@#$%', goodCaseNote.caseId, goodCaseNote.updatedBy.id],
    ['caseId', goodCaseNote.id, undefined, goodCaseNote.updatedBy.id],
    ['caseId', goodCaseNote.id, '@#$%', goodCaseNote.updatedBy.id],
    ['userId', goodCaseNote.id, goodCaseNote.caseId, undefined],
    ['all params', undefined, undefined, undefined],
  ];

  test.each(testParams)(
    'should fail archive request when params are missing %s',
    async (
      _testCase: string,
      id: string | undefined,
      caseId: string | undefined,
      userId: string | undefined,
    ) => {
      applicationContext.request = mockCamsHttpRequest({
        method: 'DELETE',
        params: {
          caseId: caseId,
          noteId: id,
          userId: userId,
        },
      });
      const controller = new CaseNotesController(applicationContext);
      await expect(controller.handleRequest(applicationContext)).rejects.toThrow();
    },
  );

  test('should call editCaseNote if PUT request and valid request structure', async () => {
    const mockCase = MockData.getCaseBasics();
    const testNote = MockData.getCaseNote({
      caseId: mockCase.caseId,
      updatedBy: getCamsUserReference(user),
    });
    const editSpy = jest
      .spyOn(CaseNotesUseCase.prototype, 'editCaseNote')
      .mockResolvedValue({ ...testNote });
    MockData.getCaseNoteEditRequest({
      note: testNote,
    });
    applicationContext.request = mockCamsHttpRequest<CaseNoteInput>({
      body: {
        caseId: mockCase.caseId,
        content: 'some test string',
        title: 'test note title',
      },
      method: 'PUT',
      params: {
        caseId: mockCase.caseId,
        noteId: testNote.id,
      },
    });
    const controller = new CaseNotesController(applicationContext);
    await controller.handleRequest(applicationContext);

    expect(editSpy).toHaveBeenCalled();
  });
});
