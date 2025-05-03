import { InvocationContext } from '@azure/functions';

import { CaseHistory } from '../../../../common/src/cams/history';
import MockData from '../../../../common/src/cams/test-utilities/mock-data';
import { CamsHttpRequest } from '../../../lib/adapters/types/http';
import { NotFoundError } from '../../../lib/common-errors/not-found-error';
import { CaseHistoryController } from '../../../lib/controllers/case-history/case-history.controller';
import { CASE_HISTORY } from '../../../lib/testing/mock-data/case-history.mock';
import { NORMAL_CASE_ID, NOT_FOUND_ERROR_CASE_ID } from '../../../lib/testing/testing-constants';
import ContextCreator from '../../azure/application-context-creator';
import {
  buildTestResponseError,
  buildTestResponseSuccess,
  createMockAzureFunctionRequest,
} from '../../azure/testing-helpers';
import handler from './case-history.function';

describe('Case History Function Tests', () => {
  const defaultRequestProps: Partial<CamsHttpRequest> = {
    method: 'GET',
    params: {
      caseId: '',
    },
  };
  let context;

  beforeEach(() => {
    context = new InvocationContext();
    jest
      .spyOn(ContextCreator, 'getApplicationContextSession')
      .mockResolvedValue(MockData.getManhattanAssignmentManagerSession());
  });

  test('Should return case history for an existing case ID', async () => {
    const caseId = NORMAL_CASE_ID;
    const requestOverride: Partial<CamsHttpRequest> = {
      params: {
        caseId,
      },
    };
    const request = createMockAzureFunctionRequest({
      ...defaultRequestProps,
      ...requestOverride,
    });

    const { azureHttpResponse, camsHttpResponse } = buildTestResponseSuccess<CaseHistory[]>({
      data: CASE_HISTORY,
      meta: {
        self: request.url,
      },
    });
    jest
      .spyOn(CaseHistoryController.prototype, 'handleRequest')
      .mockResolvedValue(camsHttpResponse);

    const response = await handler(request, context);
    expect(response).toEqual(azureHttpResponse);
  });

  test('Should return an error response for a non-existent case ID', async () => {
    const error = new NotFoundError('test-module');
    jest.spyOn(CaseHistoryController.prototype, 'handleRequest').mockRejectedValue(error);

    const requestOverride = {
      params: {
        caseId: NOT_FOUND_ERROR_CASE_ID,
      },
    };

    const request = createMockAzureFunctionRequest({
      ...defaultRequestProps,
      ...requestOverride,
    });

    const { azureHttpResponse } = buildTestResponseError(error);

    const response = await handler(request, context);
    expect(response).toEqual(azureHttpResponse);
  });
});
