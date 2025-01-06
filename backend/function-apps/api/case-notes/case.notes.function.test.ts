import handler from './case.notes.function';
import { CaseNotesController } from '../../../lib/controllers/case-notes/case.notes.controller';
import ContextCreator from '../../azure/application-context-creator';
import { MockData } from '../../../../common/src/cams/test-utilities/mock-data';
import { CamsHttpRequest } from '../../../lib/adapters/types/http';
import { InvocationContext } from '@azure/functions';
import {
  buildTestResponseError,
  buildTestResponseSuccess,
  createMockAzureFunctionRequest,
} from '../../azure/testing-helpers';
import { UnknownError } from '../../../lib/common-errors/unknown-error';
import { NORMAL_CASE_ID } from '../../../lib/testing/testing-constants';
import { CaseNote } from '../../../../common/src/cams/cases';

describe('Case Notes Function Tests', () => {
  const defaultRequestProps: Partial<CamsHttpRequest> = {
    method: 'POST',
    body: {
      caseId: '081-67-89123',
      note: 'Sample note text',
    },
  };

  let context;

  beforeEach(() => {
    jest
      .spyOn(ContextCreator, 'getApplicationContextSession')
      .mockResolvedValue(MockData.getManhattanAssignmentManagerSession());
    context = new InvocationContext({
      logHandler: () => {},
      invocationId: 'id',
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('should handle successful response', async () => {
    const req = createMockAzureFunctionRequest();
    const { azureHttpResponse, camsHttpResponse } = buildTestResponseSuccess({
      meta: {
        self: req.url,
      },
      data: undefined,
    });
    jest.spyOn(CaseNotesController.prototype, 'handleRequest').mockResolvedValue(camsHttpResponse);

    const response = await handler(req, context);
    expect(response).toEqual(azureHttpResponse);
  });

  test('should handle error', async () => {
    const req = createMockAzureFunctionRequest();
    const error = new Error('Some unknown error');
    const { azureHttpResponse } = buildTestResponseError(error);
    jest.spyOn(CaseNotesController.prototype, 'handleRequest').mockRejectedValue(error);
    const response = await handler(req, context);
    expect(response).toEqual(azureHttpResponse);
  });

  // TODO: did we need this stuff for a controller test?
  test.skip('Return the function response with the note Id created for the new case note', async () => {
    const caseId = NORMAL_CASE_ID;
    const requestOverride: Partial<CamsHttpRequest> = {
      params: {
        caseId,
      },
    };
    const expectedCaseNotes = [
      MockData.getCaseNote({ caseId: NORMAL_CASE_ID }),
      MockData.getCaseNote({ caseId: NORMAL_CASE_ID }),
    ];
    const request = createMockAzureFunctionRequest({
      ...defaultRequestProps,
      ...requestOverride,
    });

    const { azureHttpResponse, camsHttpResponse } = buildTestResponseSuccess<CaseNote[]>({
      meta: {
        self: request.url,
      },
      data: expectedCaseNotes,
    });

    jest.spyOn(CaseNotesController.prototype, 'handleRequest').mockResolvedValue(camsHttpResponse);

    const response = await handler(request, context);
    expect(response).toEqual(azureHttpResponse);
  });

  test.skip('Should return an HTTP Error if the controller throws an error during note creation', async () => {
    const error = new UnknownError('MOCK_CASE_NOTE_MODULE');
    const { azureHttpResponse } = buildTestResponseError(error);
    jest.spyOn(CaseNotesController.prototype, 'handleRequest').mockRejectedValue(error);

    const requestOverride = {
      body: {
        caseId: '001-67-89123',
      },
    };

    const request = createMockAzureFunctionRequest({
      ...defaultRequestProps,
      ...requestOverride,
    });

    const response = await handler(request, context);
    expect(response).toEqual(azureHttpResponse);
  });

  test.skip('Should return a list of notes when valid caseId is supplied for GET request', async () => {
    const caseId = '001-67-89012';
    const requestOverride: Partial<CamsHttpRequest> = {
      method: 'GET',
      params: {
        id: caseId,
      },
      body: undefined,
    };

    const request = createMockAzureFunctionRequest({
      ...defaultRequestProps,
      ...requestOverride,
    });

    const expectedNoteList = MockData.buildArray(MockData.getCaseNote, 3);
    const { azureHttpResponse, camsHttpResponse } = buildTestResponseSuccess<CaseNote[]>({
      meta: {
        self: request.url,
      },
      data: expectedNoteList,
    });
    const getNotesSpy = jest
      .spyOn(CaseNotesController.prototype, 'handleRequest')
      .mockResolvedValue(camsHttpResponse);

    await handler(request, context);
    expect(getNotesSpy).toHaveReturnedWith(azureHttpResponse);
  });
});
