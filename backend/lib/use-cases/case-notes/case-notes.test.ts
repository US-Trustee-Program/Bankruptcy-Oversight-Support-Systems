import { randomUUID } from 'crypto';
import { CaseNote, CaseNoteInput } from '../../../../common/src/cams/cases';
import MockData from '../../../../common/src/cams/test-utilities/mock-data';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import { NORMAL_CASE_ID } from '../../testing/testing-constants';
import {
  createMockApplicationContext,
  createMockApplicationContextSession,
} from '../../testing/testing-utilities';
import { CaseNotesUseCase } from './case-notes';
import { REGION_02_GROUP_NY } from '../../../../common/src/cams/test-utilities/mock-user';
import { CamsRole } from '../../../../common/src/cams/roles';

describe('Test case-notes use case', () => {
  test('should return a list of case notes when getCaseNotes is called', async () => {
    const expectedCaseNotesArray = MockData.buildArray(MockData.getCaseNote, 3);
    jest
      .spyOn(MockMongoRepository.prototype, 'getNotesByCaseId')
      .mockResolvedValue(expectedCaseNotesArray);

    const context = await createMockApplicationContext();
    const useCase = new CaseNotesUseCase(context);
    const caseNotesResult = await useCase.getCaseNotes(NORMAL_CASE_ID);

    expect(expectedCaseNotesArray).toEqual(caseNotesResult);
  });

  test('should create a case note when createCaseNote is called', async () => {
    const mockCase = MockData.getCaseBasics();
    const caseNoteContent = 'Some content relevant to the case.';
    const caseNoteTitle = 'Some Case Note Title.';
    const user = MockData.getCamsUserReference();

    const context = await createMockApplicationContext();
    const useCase = new CaseNotesUseCase(context);
    const createSpy = jest
      .spyOn(MockMongoRepository.prototype, 'create')
      .mockImplementation(async () => {});

    const expectedNote: CaseNote = {
      title: caseNoteTitle,
      documentType: 'NOTE',
      caseId: mockCase.caseId,
      updatedBy: user,
      updatedOn: expect.anything(),
      content: caseNoteContent,
    };
    const caseNoteInput: CaseNoteInput = {
      caseId: mockCase.caseId,
      title: caseNoteTitle,
      content: caseNoteContent,
    };
    await useCase.createCaseNote(user, caseNoteInput);

    expect(createSpy).toHaveBeenCalledWith(expectedNote);
  });

  test('should update a case Note and call archive with correct parameters when archiveCaseNote is called', async () => {
    const userRef = MockData.getCamsUserReference();
    const user = {
      ...userRef,
      offices: [REGION_02_GROUP_NY],
      roles: [CamsRole.CaseAssignmentManager],
    };

    const context = await createMockApplicationContext();
    context.session = await createMockApplicationContextSession({ user });

    const useCase = new CaseNotesUseCase(context);
    const archiveSpy = jest
      .spyOn(MockMongoRepository.prototype, 'archiveCaseNote')
      .mockImplementation(async () => {});

    const archiveNoteRequest = MockData.getCaseNoteArchivalRequest({
      id: randomUUID(),
      userId: user.id,
    });

    const expectedArchiveNote: Partial<CaseNote> = {
      id: archiveNoteRequest.id,
      caseId: archiveNoteRequest.caseId,
      archivedOn: expect.anything(),
    };

    await useCase.archiveCaseNote(archiveNoteRequest);

    expect(archiveSpy).toHaveBeenCalledWith(expectedArchiveNote);
  });

  test('should throw error when user is not user on the note when attempting to archive', async () => {
    const userRef = MockData.getCamsUserReference();
    const wrongUserRef = MockData.getCamsUserReference();
    const wrongUser = {
      ...wrongUserRef,
      offices: [REGION_02_GROUP_NY],
      roles: [CamsRole.CaseAssignmentManager],
    };
    const context = await createMockApplicationContext();
    context.session = await createMockApplicationContextSession({ user: wrongUser });

    const useCase = new CaseNotesUseCase(context);

    const archiveNoteRequest = MockData.getCaseNoteArchivalRequest({
      id: randomUUID(),
      userId: userRef.id,
    });

    await expect(useCase.archiveCaseNote(archiveNoteRequest)).rejects.toThrow(
      'User is not creator of the note.',
    );
  });
});
