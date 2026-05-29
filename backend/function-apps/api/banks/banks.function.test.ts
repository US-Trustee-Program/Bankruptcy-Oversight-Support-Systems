import { vi } from 'vitest';
import { InvocationContext } from '@azure/functions';
import { CamsError } from '../../../lib/common-errors/cams-error';
import handler, { trusteesHandler, historyHandler } from './banks.function';
import ContextCreator from '../../azure/application-context-creator';
import {
  buildTestResponseError,
  buildTestResponseSuccess,
  createMockAzureFunctionRequest,
} from '../../azure/testing-helpers';
import { BanksController } from '../../../lib/controllers/banks/banks.controller';
import { BankTrusteesController } from '../../../lib/controllers/bank-trustees/bank-trustees.controller';
import { BankHistoryController } from '../../../lib/controllers/bank-history/bank-history.controller';
import { CamsHttpResponseInit } from '../../../lib/adapters/utils/http-response';
import { BankProfile } from '@common/cams/banks';
import MockData from '@common/cams/test-utilities/mock-data';
import { createMockApplicationContext } from '../../../lib/testing/testing-utilities';

describe('Banks Function tests', () => {
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

  test('should delegate to controller.handleRequest and return response', async () => {
    const request = createMockAzureFunctionRequest({ method: 'GET' });
    const { camsHttpResponse, azureHttpResponse } = buildTestResponseSuccess<BankProfile[]>({
      data: mockBanks,
    });
    vi.spyOn(BanksController.prototype, 'handleRequest').mockResolvedValue(
      camsHttpResponse as CamsHttpResponseInit,
    );

    const response = await handler(request, context);

    expect(response).toEqual(azureHttpResponse);
  });

  test('should return error response when controller throws', async () => {
    const request = createMockAzureFunctionRequest({ method: 'GET' });
    const error = new CamsError('BANKS-CONTROLLER', { message: 'Something went wrong.' });
    const { azureHttpResponse, loggerCamsErrorSpy } = buildTestResponseError(error);
    vi.spyOn(BanksController.prototype, 'handleRequest').mockRejectedValue(error);

    const response = await handler(request, context);

    expect(response).toMatchObject(azureHttpResponse);
    expect(loggerCamsErrorSpy).toHaveBeenCalledWith(error);
  });

  describe('trusteesHandler', () => {
    test('should delegate to BankTrusteesController and return response', async () => {
      const request = createMockAzureFunctionRequest({ method: 'GET' });
      const { camsHttpResponse, azureHttpResponse } = buildTestResponseSuccess({ data: [] });
      vi.spyOn(BankTrusteesController.prototype, 'handleRequest').mockResolvedValue(
        camsHttpResponse,
      );

      const response = await trusteesHandler(request, context);

      expect(response).toEqual(azureHttpResponse);
    });

    test('should return error response when controller throws', async () => {
      const request = createMockAzureFunctionRequest({ method: 'GET' });
      const error = new CamsError('BANK-TRUSTEES-CONTROLLER', {
        message: 'Something went wrong.',
      });
      const { azureHttpResponse, loggerCamsErrorSpy } = buildTestResponseError(error);
      vi.spyOn(BankTrusteesController.prototype, 'handleRequest').mockRejectedValue(error);

      const response = await trusteesHandler(request, context);

      expect(response).toMatchObject(azureHttpResponse);
      expect(loggerCamsErrorSpy).toHaveBeenCalledWith(error);
    });
  });

  describe('historyHandler', () => {
    test('should delegate to BankHistoryController and return response', async () => {
      const request = createMockAzureFunctionRequest({ method: 'GET' });
      const { camsHttpResponse, azureHttpResponse } = buildTestResponseSuccess({ data: [] });
      vi.spyOn(BankHistoryController.prototype, 'handleRequest').mockResolvedValue(
        camsHttpResponse,
      );

      const response = await historyHandler(request, context);

      expect(response).toEqual(azureHttpResponse);
    });

    test('should return error response when controller throws', async () => {
      const request = createMockAzureFunctionRequest({ method: 'GET' });
      const error = new CamsError('BANK-HISTORY-CONTROLLER', {
        message: 'Something went wrong.',
      });
      const { azureHttpResponse, loggerCamsErrorSpy } = buildTestResponseError(error);
      vi.spyOn(BankHistoryController.prototype, 'handleRequest').mockRejectedValue(error);

      const response = await historyHandler(request, context);

      expect(response).toMatchObject(azureHttpResponse);
      expect(loggerCamsErrorSpy).toHaveBeenCalledWith(error);
    });
  });
});
