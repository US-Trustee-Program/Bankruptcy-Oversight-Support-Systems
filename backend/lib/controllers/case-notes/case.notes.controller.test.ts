import MockData from '../../../../common/src/cams/test-utilities/mock-data';
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
import { CaseNoteDeleteRequest, CaseNoteInput } from '../../../../common/src/cams/cases';
import { getCamsUserReference } from '../../../../common/src/cams/session';

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
      title: 'test note title',
      content: 'some test string',
    };

    applicationContext.request = mockCamsHttpRequest({
      method: 'POST',
      params: {
        caseId: mockCase.caseId,
      },
      body,
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
      method: 'POST',
      params: {
        caseId: '',
      },
      body: {
        caseId: undefined,
        title: undefined,
        content: undefined,
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
      method: 'POST',
      params: {
        caseId: 'n-1f23',
      },
      body: {
        caseId: undefined,
        title: undefined,
        content: undefined,
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
      method: 'POST',
      params: {
        caseId: NORMAL_CASE_ID,
      },
      body: {
        caseId: undefined,
        title: undefined,
        content: undefined,
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
      method: 'POST',
      params: {
        caseId: NORMAL_CASE_ID,
      },
      body: {
        caseId: NORMAL_CASE_ID,
        title: undefined,
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

    applicationContext.request = mockCamsHttpRequest<CaseNoteInput>({
      method: 'POST',
      params: {
        caseId: NORMAL_CASE_ID,
      },
      body: {
        content: undefined,
        caseId: NORMAL_CASE_ID,
        title: 'test note title',
      },
    });
    const controller = new CaseNotesController(applicationContext);
    await expect(controller.handleRequest(applicationContext)).rejects.toThrow(
      'Required parameter case note content is absent.',
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
      id: archiveNote.id,
      caseId: archiveNote.caseId,
      sessionUser: applicationContext.session.user,
    };

    applicationContext.request = mockCamsHttpRequest({
      method: 'DELETE',
      params: {
        noteId: archiveNote.id,
        caseId: archiveNote.caseId,
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
          noteId: id,
          caseId: caseId,
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
      method: 'PUT',
      params: {
        caseId: mockCase.caseId,
        noteId: testNote.id,
      },
      body: {
        caseId: mockCase.caseId,
        title: 'test note title',
        content: 'some test string',
      },
    });
    const controller = new CaseNotesController(applicationContext);
    await controller.handleRequest(applicationContext);

    expect(editSpy).toHaveBeenCalled();
  });
});
