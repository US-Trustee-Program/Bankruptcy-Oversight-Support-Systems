import { vi } from 'vitest';
import { InvocationContext } from '@azure/functions';
import { CamsError } from '../../../lib/common-errors/cams-error';
import handler from './bankruptcy-software.function';
import ContextCreator from '../../azure/application-context-creator';
import {
  buildTestResponseError,
  buildTestResponseSuccess,
  createMockAzureFunctionRequest,
} from '../../azure/testing-helpers';
import { BankruptcySoftwareController } from '../../../lib/controllers/bankruptcy-software/bankruptcy-software.controller';
import { BankruptcySoftwareProfile } from '@common/cams/bankruptcy-software';
import MockData from '@common/cams/test-utilities/mock-data';

describe('Bankruptcy Software Function tests', () => {
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

  const mockSoftware: BankruptcySoftwareProfile[] = [
    {
      id: 'sw-1',
      documentType: 'BANKRUPTCY_SOFTWARE',
      name: 'Axos',
      status: 'active',
      updatedOn: '2024-01-01T00:00:00.000Z',
      updatedBy: { id: 'user-1', name: 'User One' },
    },
  ];

  test('should return 200 with software list for GET request', async () => {
    const request = createMockAzureFunctionRequest({ method: 'GET' });
    const { camsHttpResponse, azureHttpResponse } = buildTestResponseSuccess<
      BankruptcySoftwareProfile[]
    >({
      data: mockSoftware,
    });
    vi.spyOn(BankruptcySoftwareController.prototype, 'handleGet').mockResolvedValue(
      camsHttpResponse,
    );

    const response = await handler(request, context);

    expect(response).toEqual(azureHttpResponse);
  });

  test('should return 201 with created software for POST request', async () => {
    const request = createMockAzureFunctionRequest({
      method: 'POST',
      body: { name: 'Axos' },
    });
    const createdSoftware = mockSoftware[0];
    const { camsHttpResponse, azureHttpResponse } =
      buildTestResponseSuccess<BankruptcySoftwareProfile>(
        { data: createdSoftware },
        { statusCode: 201 },
      );
    vi.spyOn(BankruptcySoftwareController.prototype, 'handlePost').mockResolvedValue(
      camsHttpResponse,
    );

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
    const error = new CamsError('BANKRUPTCY-SOFTWARE-CONTROLLER', {
      message: 'Something went wrong.',
    });
    const { azureHttpResponse, loggerCamsErrorSpy } = buildTestResponseError(error);
    vi.spyOn(BankruptcySoftwareController.prototype, 'handleGet').mockRejectedValue(error);

    const response = await handler(request, context);

    expect(response).toMatchObject(azureHttpResponse);
    expect(loggerCamsErrorSpy).toHaveBeenCalledWith(error);
  });
});
