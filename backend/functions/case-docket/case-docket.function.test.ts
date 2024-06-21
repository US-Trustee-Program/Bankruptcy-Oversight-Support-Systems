import httpTrigger from './case-docket.function';
import { DXTR_CASE_DOCKET_ENTRIES } from '../lib/testing/mock-data/case-docket-entries.mock';
import { NORMAL_CASE_ID, NOT_FOUND_ERROR_CASE_ID } from '../lib/testing/testing-constants';
import { ApplicationContext } from '../lib/adapters/types/basic';
import { createMockApplicationContext } from '../lib/testing/testing-utilities';

describe('Case docket function', () => {
  let context: ApplicationContext;

  beforeEach(async () => {
    context = await createMockApplicationContext();
  });

  test('Should return a docket consisting of a list of docket entries an existing case ID', async () => {
    const caseId = NORMAL_CASE_ID;
    const request = {
      params: {
        caseId,
      },
    };
    const expectedResponseBody = {
      success: true,
      body: DXTR_CASE_DOCKET_ENTRIES,
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
    const expectedErrorResponse = {
      success: false,
      message: 'Not found',
    };
    await httpTrigger(context, request);
    expect(context.res.body).toEqual(expectedErrorResponse);
  });
});
