import handler from './case-docket.function';
import { DXTR_CASE_DOCKET_ENTRIES } from '../lib/testing/mock-data/case-docket-entries.mock';
import { NORMAL_CASE_ID, NOT_FOUND_ERROR_CASE_ID } from '../lib/testing/testing-constants';
import { InvocationContext } from '@azure/functions';
import { CamsHttpRequest } from '../lib/adapters/types/http';
import { createMockAzureFunctionRequest } from '../azure/testing-helpers';

describe('Case docket function', () => {
  const caseId = NORMAL_CASE_ID;

  const defaultRequestProps: Partial<CamsHttpRequest> = {
    params: { caseId: caseId },
  };

  const context = new InvocationContext({
    logHandler: () => {},
    invocationId: 'id',
  });

  test('Should return a docket consisting of a list of docket entries an existing case ID', async () => {
    const request = createMockAzureFunctionRequest(defaultRequestProps);
    const response = await handler(request, context);
    expect(response.jsonBody).toEqual(DXTR_CASE_DOCKET_ENTRIES);
  });

  test('Should return an error response for a non-existent case ID', async () => {
    const bogusCaseId = NOT_FOUND_ERROR_CASE_ID;
    const requestOverride = {
      params: {
        caseId: bogusCaseId,
      },
    };
    const request = createMockAzureFunctionRequest({
      ...defaultRequestProps,
      ...requestOverride,
    });
    const expectedErrorResponse = {
      success: false,
      message: 'Not found',
    };
    const response = await handler(request, context);
    expect(response.jsonBody).toEqual(expectedErrorResponse);
  });
});
