import { vi } from 'vitest';
import handler from './case-docket.function';
import { DXTR_CASE_DOCKET_ENTRIES } from '../../../lib/testing/mock-data/case-docket-entries.mock';
import { NORMAL_CASE_ID, NOT_FOUND_ERROR_CASE_ID } from '../../../lib/testing/testing-constants';
import { InvocationContext } from '@azure/functions';
import { CamsHttpRequest } from '../../../lib/adapters/types/http';
import {
  buildTestResponseError,
  buildTestResponseSuccess,
  createMockAzureFunctionRequest,
} from '../../azure/testing-helpers';
import { CaseDocketController } from '../../../lib/controllers/case-docket/case-docket.controller';
import { NotFoundError } from '../../../lib/common-errors/not-found-error';
import { CaseDocket } from 'common/cams/cases';

describe('Case docket function', () => {
  const context = new InvocationContext({
    logHandler: () => {},
    invocationId: 'id',
  });

  test('Should return a docket consisting of a list of docket entries an existing case ID', async () => {
    const requestProps: Partial<CamsHttpRequest> = {
      params: { caseId: NORMAL_CASE_ID },
    };
    const request = createMockAzureFunctionRequest(requestProps);
    const { camsHttpResponse, azureHttpResponse } = buildTestResponseSuccess<CaseDocket>({
      data: DXTR_CASE_DOCKET_ENTRIES,
    });
    vi.spyOn(CaseDocketController.prototype, 'handleRequest').mockResolvedValue(camsHttpResponse);

    const response = await handler(request, context);
    expect(response).toEqual(azureHttpResponse);
  });

  test('Should return an error response for a non-existent case ID', async () => {
    const requestProps: Partial<CamsHttpRequest> = {
      params: { caseId: NOT_FOUND_ERROR_CASE_ID },
    };
    const request = createMockAzureFunctionRequest(requestProps);
    const error = new NotFoundError('TEST-MODULE');
    const { azureHttpResponse } = buildTestResponseError(error);
    vi.spyOn(CaseDocketController.prototype, 'handleRequest').mockRejectedValue(error);

    const response = await handler(request, context);

    expect(response).toEqual(azureHttpResponse);
  });
});
