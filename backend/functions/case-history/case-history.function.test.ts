import { CASE_HISTORY } from '../lib/testing/mock-data/case-history.mock';
import { NORMAL_CASE_ID, NOT_FOUND_ERROR_CASE_ID } from '../lib/testing/testing-constants';
import httpTrigger from './case-history.function';
import { MockHumbleQuery } from '../lib/testing/mock.cosmos-client-humble';
import { NotFoundError } from '../lib/common-errors/not-found-error';
import { createMockAzureFunctionRequest } from '../azure/functions';

describe('Case docket function', () => {
  const request = createMockAzureFunctionRequest({
    params: {
      caseId: '',
    },
    method: 'GET',
  });

  const context = require('azure-function-context-mock');

  test('Should return case history for an existing case ID', async () => {
    jest
      .spyOn(MockHumbleQuery.prototype, 'fetchAll')
      .mockResolvedValue({ resources: CASE_HISTORY });

    const caseId = NORMAL_CASE_ID;
    const requestOverride = {
      ...request,
      params: {
        caseId: caseId,
      },
    };

    const expectedResponseBody = {
      success: true,
      body: CASE_HISTORY,
    };

    await httpTrigger(context, requestOverride);
    expect(context.res.body).toEqual(expectedResponseBody);
  });

  test('Should return an error response for a non-existent case ID', async () => {
    jest
      .spyOn(MockHumbleQuery.prototype, 'fetchAll')
      .mockRejectedValue(new NotFoundError('test-module'));
    const requestOverride = {
      ...request,
      params: {
        caseId: NOT_FOUND_ERROR_CASE_ID,
      },
    };
    const expectedErrorResponse = {
      success: false,
      message: 'Not found',
    };
    await httpTrigger(context, requestOverride);
    expect(context.res.body).toEqual(expectedErrorResponse);
  });
});
