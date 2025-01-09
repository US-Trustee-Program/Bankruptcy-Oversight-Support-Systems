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

  test('should call createCaseNote on a case if POST request', async () => {
    const createSpy = jest.spyOn(CaseNotesUseCase.prototype, 'createCaseNote').mockResolvedValue();

    const mockCase = MockData.getCaseBasics();
    applicationContext.request = mockCamsHttpRequest({
      method: 'POST',
      params: {
        id: mockCase.caseId,
      },
      body: {
        note: 'some test string',
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
      'Required parameter caseId is absent.',
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

  test('should throw error when no case note is provided', async () => {
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
      'Required parameter case note is absent.',
    );
  });

  const validNotes = [
    ["Let's remove this item."],
    ['We need to find a better way.'],
    ['This is a safe string.'],
    ["Let's fetch some data."],
    ['This is just a plain sentence.'],
  ];
  test.each(validNotes)(
    'should succeed when caseId and valid case note are provided',
    async (note: string) => {
      const createSpy = jest
        .spyOn(CaseNotesUseCase.prototype, 'createCaseNote')
        .mockResolvedValue();

      applicationContext.request = mockCamsHttpRequest({
        method: 'POST',
        params: {
          id: NORMAL_CASE_ID,
        },
        body: {
          note: note,
        },
      });
      const controller = new CaseNotesController(applicationContext);
      controller.handleRequest(applicationContext);
      expect(createSpy).toHaveBeenCalled();
    },
  );

  const testXSSNotes = [
    ['<script></script>'],
    ['<script>foo</script>'],
    ["<script>alert('XSS');</script>"],
    ['Use setTimeout(() => {}, 1000);'],
    ["document.querySelector('#id');"],
    ["fetch('/api/data');"],
  ];
  test.each(testXSSNotes)('should throw error when XSS note is provided', async (note: string) => {
    jest.spyOn(CaseNotesUseCase.prototype, 'createCaseNote').mockResolvedValue();
    applicationContext.request = mockCamsHttpRequest({
      method: 'POST',
      params: {
        id: NORMAL_CASE_ID,
      },
      body: {
        note: note,
      },
    });

    const controller = new CaseNotesController(applicationContext);
    await expect(controller.handleRequest(applicationContext)).rejects.toThrow(
      'Note content contains invalid keywords.',
    );
  });

  const testMongoInjectedNotes = [
    ["db.remove({ key: 'value' });"],
    ['mongo.aggregate([{ key: 1 }]);'],
  ];
  test.each(testMongoInjectedNotes)(
    'should throw error when Mongo Injected note is provided',
    async (note: string) => {
      jest.spyOn(CaseNotesUseCase.prototype, 'createCaseNote').mockResolvedValue();
      applicationContext.request = mockCamsHttpRequest({
        method: 'POST',
        params: {
          id: NORMAL_CASE_ID,
        },
        body: {
          note: note,
        },
      });

      const controller = new CaseNotesController(applicationContext);
      await expect(controller.handleRequest(applicationContext)).rejects.toThrow(
        'Note content contains invalid keywords.',
      );
    },
  );

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
});
