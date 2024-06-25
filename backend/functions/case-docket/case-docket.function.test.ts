import httpTrigger from './case-docket.function';
import { DXTR_CASE_DOCKET_ENTRIES } from '../lib/testing/mock-data/case-docket-entries.mock';
import { NORMAL_CASE_ID, NOT_FOUND_ERROR_CASE_ID } from '../lib/testing/testing-constants';
import { createMockAzureFunctionRequest } from '../azure/functions';

describe('Case docket function', () => {
  const caseId = NORMAL_CASE_ID;
  const request = createMockAzureFunctionRequest({ params: { caseId } });
  const context = require('azure-function-context-mock');

  test('Should return a docket consisting of a list of docket entries an existing case ID', async () => {
    const expectedResponseBody = {
      success: true,
      body: DXTR_CASE_DOCKET_ENTRIES,
    };
    await httpTrigger(context, request);
    expect(context.res.body).toEqual(expectedResponseBody);
  });

  test('Should return an error response for a non-existent case ID', async () => {
    const bogusCaseId = NOT_FOUND_ERROR_CASE_ID;
    const requestOverride = {
      ...request,
      params: {
        caseId: bogusCaseId,
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
