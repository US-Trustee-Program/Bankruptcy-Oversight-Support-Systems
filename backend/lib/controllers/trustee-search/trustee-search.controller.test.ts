import { vi, describe, test, expect, beforeEach } from 'vitest';
import { TrusteeSearchController } from './trustee-search.controller';
import { TrusteeSearchUseCase } from '../../use-cases/trustees/trustee-search.use-case';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { ApplicationContext } from '../../adapters/types/basic';
import { CamsRole } from '@common/cams/roles';
import { TrusteeSearchResult } from '@common/cams/trustee-search';

describe('TrusteeSearchController', () => {
  let context: ApplicationContext;
  let controller: TrusteeSearchController;

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

  beforeEach(async () => {
    vi.restoreAllMocks();
    context = await createMockApplicationContext();
    context.request.method = 'GET';
    context.request.query = { name: 'smith' };
    context.session.user.roles = [CamsRole.DataVerifier];
    controller = new TrusteeSearchController();
  });

  test.each([
    {
      name: 'no filters',
      query: { name: 'smith' },
      expectedArgs: ['smith', undefined, undefined, undefined],
    },
    {
      name: 'courtId only',
      query: { name: 'smith', courtId: '081' },
      expectedArgs: ['smith', '081', undefined, undefined],
    },
    {
      name: 'courtId, divisionCode, and chapter',
      query: { name: 'smith', courtId: '081', divisionCode: '081', chapter: '7' },
      expectedArgs: ['smith', '081', '081', '7'],
    },
  ])('passes $name through to searchTrustees', async ({ query, expectedArgs }) => {
    context.request.query = query;
    vi.spyOn(TrusteeSearchUseCase.prototype, 'searchTrustees').mockResolvedValue(mockSearchResults);

    const response = await controller.handleRequest(context);

    expect(TrusteeSearchUseCase.prototype.searchTrustees).toHaveBeenCalledWith(
      context,
      ...expectedArgs,
    );
    expect(response.body.data).toEqual(mockSearchResults);
  });

  test('should return 401 when user does not have DataVerifier role', async () => {
    context.session.user.roles = [];

    await expect(controller.handleRequest(context)).rejects.toThrow('Unauthorized');
  });

  test('should allow TrusteeAdmin role', async () => {
    context.session.user.roles = [CamsRole.TrusteeAdmin];
    vi.spyOn(TrusteeSearchUseCase.prototype, 'searchTrustees').mockResolvedValue(mockSearchResults);

    const response = await controller.handleRequest(context);

    expect(response.body.data).toEqual(mockSearchResults);
  });

  test('should return 400 when name query parameter is missing', async () => {
    context.request.query = {};

    await expect(controller.handleRequest(context)).rejects.toThrow(
      'Missing required query parameter: name',
    );
  });

  test('should return 400 when name query parameter is too short', async () => {
    context.request.query = { name: 'a' };

    await expect(controller.handleRequest(context)).rejects.toThrow(
      'Name query must be at least 2 characters',
    );
  });

  test('should throw BadRequestError for unsupported method', async () => {
    context.request.method = 'POST';

    await expect(controller.handleRequest(context)).rejects.toThrow('Unsupported method.');
  });

  test('should propagate errors from use case as CamsError', async () => {
    vi.spyOn(TrusteeSearchUseCase.prototype, 'searchTrustees').mockRejectedValue(
      new Error('Database failure'),
    );

    await expect(controller.handleRequest(context)).rejects.toThrow(
      expect.objectContaining({ isCamsError: true }),
    );
  });
});
