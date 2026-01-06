import { vi } from 'vitest';
import {
  NORMAL_TRUSTEE_ID,
  NOT_FOUND_ERROR_TRUSTEE_ID,
} from '../../../lib/testing/testing-constants';
import { NotFoundError } from '../../../lib/common-errors/not-found-error';
import { CamsHttpRequest } from '../../../lib/adapters/types/http';
import { InvocationContext } from '@azure/functions';
import handler from './trustee-history.function';
import ContextCreator from '../../azure/application-context-creator';
import MockData from 'common/cams/test-utilities/mock-data';
import { TrusteeHistoryController } from '../../../lib/controllers/trustee-history/trustee-history.controller';
import {
  buildTestResponseError,
  buildTestResponseSuccess,
  createMockAzureFunctionRequest,
} from '../../azure/testing-helpers';
import { TrusteeHistory } from 'common/cams/trustees';

const TRUSTEE_HISTORY = MockData.getTrusteeHistory();

describe('Trustee History Function Tests', () => {
  const defaultRequestProps: Partial<CamsHttpRequest> = {
    method: 'GET',
    params: {
      id: '',
    },
  };
  let context;

  beforeEach(() => {
    context = new InvocationContext();
    vi.spyOn(ContextCreator, 'getApplicationContextSession').mockResolvedValue(
      MockData.getManhattanAssignmentManagerSession(),
    );
  });

  test('Should return trustee history for an existing trustee ID', async () => {
    const requestOverride: Partial<CamsHttpRequest> = {
      params: {
        id: NORMAL_TRUSTEE_ID,
      },
    };
    const request = createMockAzureFunctionRequest({
      ...defaultRequestProps,
      ...requestOverride,
    });

    const { azureHttpResponse, camsHttpResponse } = buildTestResponseSuccess<TrusteeHistory[]>({
      meta: {
        self: request.url,
      },
      data: TRUSTEE_HISTORY,
    });
    vi.spyOn(TrusteeHistoryController.prototype, 'handleRequest').mockResolvedValue(
      camsHttpResponse,
    );

    const response = await handler(request, context);
    expect(response).toEqual(azureHttpResponse);
  });

  test('Should return an error response for a non-existent trustee ID', async () => {
    const error = new NotFoundError('test-module');
    vi.spyOn(TrusteeHistoryController.prototype, 'handleRequest').mockRejectedValue(error);

    const requestOverride = {
      params: {
        id: NOT_FOUND_ERROR_TRUSTEE_ID,
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
