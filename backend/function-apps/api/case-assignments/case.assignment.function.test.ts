import { vi } from 'vitest';
import handler from './case.assignment.function';
import { CaseAssignmentController } from '../../../lib/controllers/case-assignment/case.assignment.controller';
import ContextCreator from '../../azure/application-context-creator';
import MockData from '@common/cams/test-utilities/mock-data';
import { createMockApplicationContext } from '../../../lib/testing/testing-utilities';
import { CamsHttpRequest } from '../../../lib/adapters/types/http';
import { InvocationContext } from '@azure/functions';
import {
  buildTestResponseError,
  buildTestResponseSuccess,
  createMockAzureFunctionRequest,
} from '../../azure/testing-helpers';
import { UnknownError } from '../../../lib/common-errors/unknown-error';
import HttpStatusCodes from '@common/api/http-status-codes';

describe('Case Assignment Function Tests', () => {
  const defaultRequestProps: Partial<CamsHttpRequest> = {
    method: 'POST',
    body: {
      caseId: '081-67-89123',
      attorneyList: ['Bob Bob'],
      role: 'TrialAttorney',
    },
  };

  let context;

  beforeEach(async () => {
    const camsContext = await createMockApplicationContext();
    camsContext.session = MockData.getManhattanAssignmentManagerSession();
    vi.spyOn(ContextCreator, 'applicationContextCreator').mockResolvedValue(camsContext);
    context = new InvocationContext({
      logHandler: () => {},
      invocationId: 'id',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('Return the function response with the assignment Id created for the new case assignment', async () => {
    const { camsHttpResponse, azureHttpResponse } = buildTestResponseSuccess(undefined, {
      statusCode: HttpStatusCodes.CREATED,
    });
    vi.spyOn(CaseAssignmentController.prototype, 'handleRequest').mockResolvedValue(
      camsHttpResponse,
    );

    const request = createMockAzureFunctionRequest(defaultRequestProps);
    const response = await handler(request, context);
    expect(response).toEqual(azureHttpResponse);
  });

  test('Should return an HTTP Error if the controller throws an error during assignment creation', async () => {
    const error = new UnknownError('MOCK_CASE_ASSIGNMENT_MODULE');
    const { azureHttpResponse } = buildTestResponseError(error);
    vi.spyOn(CaseAssignmentController.prototype, 'handleRequest').mockRejectedValue(error);

    const requestOverride = {
      body: {
        caseId: '001-67-89123',
        attorneyList: ['John Doe'],
        role: 'TrialAttorney',
      },
    };

    const request = createMockAzureFunctionRequest({
      ...defaultRequestProps,
      ...requestOverride,
    });

    const response = await handler(request, context);
    expect(response).toEqual(azureHttpResponse);
  });
});
