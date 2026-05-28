import { vi } from 'vitest';
import { InvocationContext } from '@azure/functions';
import { CamsError } from '../../../lib/common-errors/cams-error';
import handler, {
  nameHandler,
  trusteesHandler,
  bankTrusteesHandler,
  historyHandler,
} from './bankruptcy-software.function';
import ContextCreator from '../../azure/application-context-creator';
import {
  buildTestResponseError,
  buildTestResponseSuccess,
  createMockAzureFunctionRequest,
} from '../../azure/testing-helpers';
import { BankruptcySoftwareController } from '../../../lib/controllers/bankruptcy-software/bankruptcy-software.controller';
import { SoftwareTrusteesController } from '../../../lib/controllers/software-trustees/software-trustees.controller';
import { SoftwareBankTrusteesController } from '../../../lib/controllers/software-bank-trustees/software-bank-trustees.controller';
import { BankruptcySoftwareHistoryController } from '../../../lib/controllers/bankruptcy-software-history/bankruptcy-software-history.controller';
import { BankruptcySoftwareProfile } from '@common/cams/bankruptcy-software';
import MockData from '@common/cams/test-utilities/mock-data';
import { CamsHttpResponseInit } from '../../../lib/adapters/utils/http-response';
import { createMockApplicationContext } from '../../../lib/testing/testing-utilities';

describe('Bankruptcy Software Function tests', () => {
  let context: InvocationContext;

  beforeEach(async () => {
    const camsContext = await createMockApplicationContext();
    camsContext.session = MockData.getCamsSession();
    vi.spyOn(ContextCreator, 'applicationContextCreator').mockResolvedValue(camsContext);
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

  test('should delegate to controller.handleRequest and return response', async () => {
    const request = createMockAzureFunctionRequest({ method: 'GET' });
    const { camsHttpResponse, azureHttpResponse } = buildTestResponseSuccess<
      BankruptcySoftwareProfile[]
    >({ data: mockSoftware });
    vi.spyOn(BankruptcySoftwareController.prototype, 'handleRequest').mockResolvedValue(
      camsHttpResponse as CamsHttpResponseInit,
    );

    const response = await handler(request, context);

    expect(response).toEqual(azureHttpResponse);
  });

  test('should return error response when controller throws', async () => {
    const request = createMockAzureFunctionRequest({ method: 'GET' });
    const error = new CamsError('BANKRUPTCY-SOFTWARE-CONTROLLER', {
      message: 'Something went wrong.',
    });
    const { azureHttpResponse, loggerCamsErrorSpy } = buildTestResponseError(error);
    vi.spyOn(BankruptcySoftwareController.prototype, 'handleRequest').mockRejectedValue(error);

    const response = await handler(request, context);

    expect(response).toMatchObject(azureHttpResponse);
    expect(loggerCamsErrorSpy).toHaveBeenCalledWith(error);
  });

  describe('nameHandler', () => {
    test('should delegate to controller.handleGetName and return response', async () => {
      const request = createMockAzureFunctionRequest({
        method: 'GET',
        params: { softwareId: 'sw-1' },
      });
      const { camsHttpResponse, azureHttpResponse } = buildTestResponseSuccess<{ name: string }>({
        data: { name: 'Axos' },
      });
      vi.spyOn(BankruptcySoftwareController.prototype, 'handleGetName').mockResolvedValue(
        camsHttpResponse as CamsHttpResponseInit,
      );

      const response = await nameHandler(request, context);

      expect(response).toEqual(azureHttpResponse);
    });

    test('should return error response when controller throws', async () => {
      const request = createMockAzureFunctionRequest({
        method: 'GET',
        params: { softwareId: 'sw-1' },
      });
      const error = new CamsError('BANKRUPTCY-SOFTWARE-CONTROLLER', {
        message: 'Not found.',
      });
      const { azureHttpResponse, loggerCamsErrorSpy } = buildTestResponseError(error);
      vi.spyOn(BankruptcySoftwareController.prototype, 'handleGetName').mockRejectedValue(error);

      const response = await nameHandler(request, context);

      expect(response).toMatchObject(azureHttpResponse);
      expect(loggerCamsErrorSpy).toHaveBeenCalledWith(error);
    });
  });

  describe('trusteesHandler', () => {
    test('should delegate to SoftwareTrusteesController and return response', async () => {
      const request = createMockAzureFunctionRequest({ method: 'GET' });
      const { camsHttpResponse, azureHttpResponse } = buildTestResponseSuccess({ data: [] });
      vi.spyOn(SoftwareTrusteesController.prototype, 'handleRequest').mockResolvedValue(
        camsHttpResponse,
      );

      const response = await trusteesHandler(request, context);

      expect(response).toEqual(azureHttpResponse);
    });

    test('should return error response when controller throws', async () => {
      const request = createMockAzureFunctionRequest({ method: 'GET' });
      const error = new CamsError('SOFTWARE-TRUSTEES-CONTROLLER', {
        message: 'Something went wrong.',
      });
      const { azureHttpResponse, loggerCamsErrorSpy } = buildTestResponseError(error);
      vi.spyOn(SoftwareTrusteesController.prototype, 'handleRequest').mockRejectedValue(error);

      const response = await trusteesHandler(request, context);

      expect(response).toMatchObject(azureHttpResponse);
      expect(loggerCamsErrorSpy).toHaveBeenCalledWith(error);
    });
  });

  describe('bankTrusteesHandler', () => {
    test('should delegate to SoftwareBankTrusteesController and return response', async () => {
      const request = createMockAzureFunctionRequest({ method: 'GET' });
      const { camsHttpResponse, azureHttpResponse } = buildTestResponseSuccess({ data: [] });
      vi.spyOn(SoftwareBankTrusteesController.prototype, 'handleRequest').mockResolvedValue(
        camsHttpResponse,
      );

      const response = await bankTrusteesHandler(request, context);

      expect(response).toEqual(azureHttpResponse);
    });

    test('should return error response when controller throws', async () => {
      const request = createMockAzureFunctionRequest({ method: 'GET' });
      const error = new CamsError('SOFTWARE-BANK-TRUSTEES-CONTROLLER', {
        message: 'Something went wrong.',
      });
      const { azureHttpResponse, loggerCamsErrorSpy } = buildTestResponseError(error);
      vi.spyOn(SoftwareBankTrusteesController.prototype, 'handleRequest').mockRejectedValue(error);

      const response = await bankTrusteesHandler(request, context);

      expect(response).toMatchObject(azureHttpResponse);
      expect(loggerCamsErrorSpy).toHaveBeenCalledWith(error);
    });
  });

  describe('historyHandler', () => {
    test('should delegate to BankruptcySoftwareHistoryController and return response', async () => {
      const request = createMockAzureFunctionRequest({ method: 'GET' });
      const { camsHttpResponse, azureHttpResponse } = buildTestResponseSuccess({ data: [] });
      vi.spyOn(BankruptcySoftwareHistoryController.prototype, 'handleRequest').mockResolvedValue(
        camsHttpResponse,
      );

      const response = await historyHandler(request, context);

      expect(response).toEqual(azureHttpResponse);
    });

    test('should return error response when controller throws', async () => {
      const request = createMockAzureFunctionRequest({ method: 'GET' });
      const error = new CamsError('BANKRUPTCY-SOFTWARE-HISTORY-CONTROLLER', {
        message: 'Something went wrong.',
      });
      const { azureHttpResponse, loggerCamsErrorSpy } = buildTestResponseError(error);
      vi.spyOn(BankruptcySoftwareHistoryController.prototype, 'handleRequest').mockRejectedValue(
        error,
      );

      const response = await historyHandler(request, context);

      expect(response).toMatchObject(azureHttpResponse);
      expect(loggerCamsErrorSpy).toHaveBeenCalledWith(error);
    });
  });
});
