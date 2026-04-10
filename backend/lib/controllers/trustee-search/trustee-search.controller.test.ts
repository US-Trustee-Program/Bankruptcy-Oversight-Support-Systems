import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest';
import { TrusteeSearchController } from './trustee-search.controller';
import { TrusteeSearchUseCase } from '../../use-cases/trustees/trustee-search.use-case';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { ApplicationContext } from '../../adapters/types/basic';
import { CamsRole } from '@common/cams/roles';
import { TrusteeSearchResult } from '@common/cams/trustee-search';

describe('TrusteeSearchController', () => {
  let context: ApplicationContext;

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
    },
  ];

  beforeEach(async () => {
    context = await createMockApplicationContext();
    context.request.method = 'GET';
    context.request.query = { name: 'smith' };
    context.session.user.roles = [CamsRole.DataVerifier];
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should return search results for a valid name query', async () => {
    vi.spyOn(TrusteeSearchUseCase.prototype, 'searchTrustees').mockResolvedValue(mockSearchResults);

    const controller = new TrusteeSearchController();
    const response = await controller.handleRequest(context);

    expect(TrusteeSearchUseCase.prototype.searchTrustees).toHaveBeenCalledWith(context, 'smith');
    expect(response.body.data).toEqual(mockSearchResults);
  });

  test('should return 401 when user does not have DataVerifier role', async () => {
    context.session.user.roles = [];

    const controller = new TrusteeSearchController();

    await expect(controller.handleRequest(context)).rejects.toThrow('Unauthorized');
  });

  test('should return 400 when name query parameter is missing', async () => {
    context.request.query = {};

    const controller = new TrusteeSearchController();

    await expect(controller.handleRequest(context)).rejects.toThrow(
      'Missing required query parameter: name',
    );
  });

  test('should return 400 when name query parameter is too short', async () => {
    context.request.query = { name: 'a' };

    const controller = new TrusteeSearchController();

    await expect(controller.handleRequest(context)).rejects.toThrow(
      'Name query must be at least 2 characters',
    );
  });

  test('should throw BadRequestError for unsupported method', async () => {
    context.request.method = 'POST';

    const controller = new TrusteeSearchController();

    await expect(controller.handleRequest(context)).rejects.toThrow('Unsupported method.');
  });

  test('should propagate errors from use case as CamsError', async () => {
    vi.spyOn(TrusteeSearchUseCase.prototype, 'searchTrustees').mockRejectedValue(
      new Error('Database failure'),
    );

    const controller = new TrusteeSearchController();

    await expect(controller.handleRequest(context)).rejects.toThrow();
  });
});
