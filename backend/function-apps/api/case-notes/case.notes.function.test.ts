import { InvocationContext } from '@azure/functions';

import { CaseNote } from '../../../../common/src/cams/cases';
import { MockData } from '../../../../common/src/cams/test-utilities/mock-data';
import { CamsHttpRequest } from '../../../lib/adapters/types/http';
import * as featureFlags from '../../../lib/adapters/utils/feature-flag';
import { UnknownError } from '../../../lib/common-errors/unknown-error';
import { CaseNotesController } from '../../../lib/controllers/case-notes/case.notes.controller';
import ContextCreator from '../../azure/application-context-creator';
import {
  buildTestResponseError,
  buildTestResponseSuccess,
  createMockAzureFunctionRequest,
} from '../../azure/testing-helpers';
import handler from './case.notes.function';

const defaultRequestProps: Partial<CamsHttpRequest> = {
  body: {
    caseId: '081-67-89123',
    note: 'Sample note text',
  },
  method: 'POST',
};

describe('Case Notes Function Tests', () => {
  let context;

  beforeEach(() => {
    jest
      .spyOn(ContextCreator, 'getApplicationContextSession')
      .mockResolvedValue(MockData.getManhattanAssignmentManagerSession());
    context = new InvocationContext({
      invocationId: 'id',
      logHandler: () => {},
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test('should handle successful response', async () => {
    const req = createMockAzureFunctionRequest();
    const { azureHttpResponse, camsHttpResponse } = buildTestResponseSuccess({
      data: undefined,
      meta: {
        self: req.url,
      },
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

  test('Should return an HTTP Error if the controller throws an error during note creation', async () => {
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

  test('Should return a list of notes when valid caseId is supplied for GET request', async () => {
    const caseId = '001-67-89012';
    const requestOverride: Partial<CamsHttpRequest> = {
      body: undefined,
      method: 'GET',
      params: {
        id: caseId,
      },
    };

    const request = createMockAzureFunctionRequest({
      ...defaultRequestProps,
      ...requestOverride,
    });

    const expectedNoteList = MockData.buildArray(MockData.getCaseNote, 3);
    const { azureHttpResponse, camsHttpResponse } = buildTestResponseSuccess<CaseNote[]>({
      data: expectedNoteList,
      meta: {
        self: request.url,
      },
    });
    jest.spyOn(CaseNotesController.prototype, 'handleRequest').mockResolvedValue(camsHttpResponse);

    const response = await handler(request, context);
    expect(response).toEqual(azureHttpResponse);
  });
});

describe('Case Notes Feature Flag Tests', () => {
  let context;

  beforeEach(() => {
    jest
      .spyOn(ContextCreator, 'getApplicationContextSession')
      .mockResolvedValue(MockData.getManhattanAssignmentManagerSession());
    context = new InvocationContext({
      invocationId: 'id',
      logHandler: () => {},
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  jest.mock('../../../lib/adapters/utils/feature-flag.ts');

  test('Should return an Unauthorized Error if case-notes-enabled is false', async () => {
    const requestOverride = {
      body: {
        caseId: '001-67-89123',
      },
    };

    const expected = {
      headers: expect.anything(),
      jsonBody: 'Unauthorized',
      status: 401,
    };

    const request = createMockAzureFunctionRequest({
      ...defaultRequestProps,
      ...requestOverride,
    });

    const { camsHttpResponse } = buildTestResponseSuccess<CaseNote[]>({
      data: [],
      meta: {
        self: request.url,
      },
    });

    jest.spyOn(featureFlags, 'getFeatureFlags').mockResolvedValue({
      'case-notes-enabled': false,
    });

    jest.spyOn(CaseNotesController.prototype, 'handleRequest').mockResolvedValue(camsHttpResponse);

    const response = await handler(request, context);

    expect(response).toEqual(expect.objectContaining(expected));
  });
});
