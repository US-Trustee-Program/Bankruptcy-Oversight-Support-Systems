import { CASE_HISTORY } from '../lib/testing/mock-data/case-history.mock';
import { NORMAL_CASE_ID, NOT_FOUND_ERROR_CASE_ID } from '../lib/testing/testing-constants';
import httpTrigger from './case-history.function';

const context = require('azure-function-context-mock');

describe('Case docket function', () => {
  test('Should return a docket consisting of a list of docket entries an existing case ID', async () => {
    const caseId = NORMAL_CASE_ID;
    const request = {
      params: {
        caseId,
      },
    };
    const expectedResponseBody = {
      success: true,
      body: CASE_HISTORY,
    };
    process.env = {
      DATABASE_MOCK: 'true',
    };
    await httpTrigger(context, request);
    expect(context.res.body).toEqual(expectedResponseBody);
  });

  test('Should return an error response for a non-existent case ID', async () => {
    const bogusCaseId = NOT_FOUND_ERROR_CASE_ID;
    const request = {
      params: {
        caseId: bogusCaseId,
      },
    };
    process.env = {
      DATABASE_MOCK: 'true',
    };
    const expectedErrorResponse = {
      success: false,
      message: 'Not found',
    };
    await httpTrigger(context, request);
    expect(context.res.body).toEqual(expectedErrorResponse);
  });
});
