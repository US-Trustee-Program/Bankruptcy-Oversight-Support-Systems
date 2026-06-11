import { vi } from 'vitest';
import { InvocationContext } from '@azure/functions';
import handler from './trustee-search-optimized.function';
import ContextCreator from '../../azure/application-context-creator';
import { TrusteeSearchOptimizedController } from '../../../lib/controllers/trustee-search-optimized/trustee-search-optimized.controller';
import MockData from '@common/cams/test-utilities/mock-data';
import {
  buildTestResponseError,
  buildTestResponseSuccess,
  createMockAzureFunctionRequest,
} from '../../azure/testing-helpers';
import { TrusteeSearchResult } from '@common/cams/trustee-search';

describe('Trustee Search Optimized Function', () => {
  let context: InvocationContext;

  const mockSearchResults: TrusteeSearchResult[] = [
    {
      trusteeId: 'trustee-001',
      name: 'John Smith',
      address: {
        address1: '123 Main St',
        city: 'New York',
        state: 'NY',
        zipCode: '10001',
        countryCode: 'US',
      },
      phone: { number: '(212) 555-0100' },
      email: 'john.smith@example.com',
      appointments: [],
      matchType: 'exact',
    },
  ];

  beforeEach(() => {
    vi.spyOn(ContextCreator, 'getApplicationContextSession').mockResolvedValue(
      MockData.getCamsSession(),
    );
    context = new InvocationContext({
      logHandler: () => {},
      invocationId: 'id',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should handle successful trustee search request', async () => {
    const req = createMockAzureFunctionRequest({
      method: 'GET',
      query: { name: 'smith' },
    });
    const { azureHttpResponse, camsHttpResponse } = buildTestResponseSuccess({
      meta: {
        self: req.url,
      },
      data: mockSearchResults,
    });

    vi.spyOn(TrusteeSearchOptimizedController.prototype, 'handleRequest').mockResolvedValue(
      camsHttpResponse,
    );

    const result = await handler(req, context);
    expect(result).toEqual(azureHttpResponse);
    expect(TrusteeSearchOptimizedController.prototype.handleRequest).toHaveBeenCalled();
  });

  test('should handle search with courtId parameter', async () => {
    const req = createMockAzureFunctionRequest({
      method: 'GET',
      query: { name: 'smith', courtId: '081' },
    });
    const { azureHttpResponse, camsHttpResponse } = buildTestResponseSuccess({
      meta: {
        self: req.url,
      },
      data: mockSearchResults,
    });

    vi.spyOn(TrusteeSearchOptimizedController.prototype, 'handleRequest').mockResolvedValue(
      camsHttpResponse,
    );

    const result = await handler(req, context);
    expect(result).toEqual(azureHttpResponse);
  });

  test('should handle errors and return azure error response', async () => {
    const req = createMockAzureFunctionRequest({
      method: 'GET',
      query: { name: 'smith' },
    });
    const error = new Error('Search failed');
    const { azureHttpResponse } = buildTestResponseError(error);

    vi.spyOn(TrusteeSearchOptimizedController.prototype, 'handleRequest').mockRejectedValue(error);

    const result = await handler(req, context);

    expect(result).toEqual(azureHttpResponse);
  });

  test('should handle validation errors for missing name parameter', async () => {
    const req = createMockAzureFunctionRequest({
      method: 'GET',
      query: {},
    });
    const error = new Error('Missing name parameter');
    const { azureHttpResponse } = buildTestResponseError(error);

    vi.spyOn(TrusteeSearchOptimizedController.prototype, 'handleRequest').mockRejectedValue(error);

    const result = await handler(req, context);

    expect(result).toEqual(azureHttpResponse);
  });
});
