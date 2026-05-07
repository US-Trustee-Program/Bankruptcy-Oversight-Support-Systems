import { vi } from 'vitest';
import { InvocationContext } from '@azure/functions';
import { CamsError } from '../../../lib/common-errors/cams-error';
import handler from './banks.function';
import ContextCreator from '../../azure/application-context-creator';
import {
  buildTestResponseError,
  buildTestResponseSuccess,
  createMockAzureFunctionRequest,
} from '../../azure/testing-helpers';
import { BanksController } from '../../../lib/controllers/banks/banks.controller';
import { BankProfile } from '@common/cams/banks';
import MockData from '@common/cams/test-utilities/mock-data';

describe('Banks Function tests', () => {
  let context: InvocationContext;

  beforeEach(() => {
    vi.spyOn(ContextCreator, 'getApplicationContextSession').mockResolvedValue(
      MockData.getCamsSession(),
    );
    context = new InvocationContext({ logHandler: () => {}, invocationId: 'test-id' });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mockBanks: BankProfile[] = [
    {
      id: 'bank-1',
      documentType: 'BANK_PROFILE',
      name: 'Alpha Bank',
      status: 'active',
      updatedOn: '2024-01-01T00:00:00.000Z',
      updatedBy: { id: 'user-1', name: 'User One' },
    },
  ];

  test('should return 200 with bank list for GET request', async () => {
    const request = createMockAzureFunctionRequest({ method: 'GET' });
    const { camsHttpResponse, azureHttpResponse } = buildTestResponseSuccess<BankProfile[]>({
      data: mockBanks,
    });
    vi.spyOn(BanksController.prototype, 'handleGet').mockResolvedValue(camsHttpResponse);

    const response = await handler(request, context);

    expect(response).toEqual(azureHttpResponse);
  });

  test('should return 201 with created bank for POST request', async () => {
    const request = createMockAzureFunctionRequest({
      method: 'POST',
      body: { name: 'Alpha Bank' },
    });
    const createdBank = mockBanks[0];
    const { camsHttpResponse, azureHttpResponse } = buildTestResponseSuccess<BankProfile>(
      { data: createdBank },
      { statusCode: 201 },
    );
    vi.spyOn(BanksController.prototype, 'handlePost').mockResolvedValue(camsHttpResponse);

    const response = await handler(request, context);

    expect(response).toEqual(azureHttpResponse);
  });

  test('should return 405 for unsupported HTTP method', async () => {
    const request = createMockAzureFunctionRequest({ method: 'DELETE' });

    const response = await handler(request, context);

    expect(response.status).toBe(405);
  });

  test('should return error response when controller throws', async () => {
    const request = createMockAzureFunctionRequest({ method: 'GET' });
    const error = new CamsError('BANKS-CONTROLLER', { message: 'Something went wrong.' });
    const { azureHttpResponse, loggerCamsErrorSpy } = buildTestResponseError(error);
    vi.spyOn(BanksController.prototype, 'handleGet').mockRejectedValue(error);

    const response = await handler(request, context);

    expect(response).toMatchObject(azureHttpResponse);
    expect(loggerCamsErrorSpy).toHaveBeenCalledWith(error);
  });
});
