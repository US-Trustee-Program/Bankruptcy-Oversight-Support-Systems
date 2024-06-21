import { CASE_HISTORY } from '../lib/testing/mock-data/case-history.mock';
import { NORMAL_CASE_ID, NOT_FOUND_ERROR_CASE_ID } from '../lib/testing/testing-constants';
import httpTrigger from './case-history.function';
import { MockHumbleQuery } from '../lib/testing/mock.cosmos-client-humble';
import { NotFoundError } from '../lib/common-errors/not-found-error';
import { ApplicationContext } from '../lib/adapters/types/basic';
import { createMockApplicationContext } from '../lib/testing/testing-utilities';

describe('Case docket function', () => {
  let context: ApplicationContext;

  beforeEach(async () => {
    context = await createMockApplicationContext();
  });

  test('Should return case history for an existing case ID', async () => {
    jest
      .spyOn(MockHumbleQuery.prototype, 'fetchAll')
      .mockResolvedValue({ resources: CASE_HISTORY });

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
    await httpTrigger(context, request);
    expect(context.res.body).toEqual(expectedResponseBody);
  });

  test('Should return an error response for a non-existent case ID', async () => {
    jest
      .spyOn(MockHumbleQuery.prototype, 'fetchAll')
      .mockRejectedValue(new NotFoundError('test-module'));
    const request = {
      params: {
        caseId: NOT_FOUND_ERROR_CASE_ID,
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
