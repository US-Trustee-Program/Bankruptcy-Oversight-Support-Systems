import { vi } from 'vitest';
import { InvocationContext } from '@azure/functions';
import { CamsError } from '../../../lib/common-errors/cams-error';
import handler from './bank-history.function';
import ContextCreator from '../../azure/application-context-creator';
import {
  buildTestResponseError,
  buildTestResponseSuccess,
  createMockAzureFunctionRequest,
} from '../../azure/testing-helpers';
import { BankHistoryController } from '../../../lib/controllers/bank-history/bank-history.controller';
import { BankAuditHistory } from '@common/cams/banks';
import MockData from '@common/cams/test-utilities/mock-data';
import { CamsHttpResponseInit } from '../../../lib/adapters/utils/http-response';
import { createMockApplicationContext } from '../../../lib/testing/testing-utilities';

describe('Bank History Function tests', () => {
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

  const mockHistory: BankAuditHistory[] = [
    {
      id: 'audit-1',
      documentType: 'AUDIT_BANK',
      bankId: 'bank-1',
      before: null,
      after: {
        id: 'bank-1',
        name: 'Alpha Bank',
        status: 'active',
        documentType: 'BANK_PROFILE',
      },
      updatedOn: '2024-01-01T00:00:00.000Z',
      updatedBy: { id: 'user-1', name: 'User One' },
    },
  ];

  test('should delegate to controller.handleRequest and return response', async () => {
    const request = createMockAzureFunctionRequest({ method: 'GET' });
    const { camsHttpResponse, azureHttpResponse } = buildTestResponseSuccess<BankAuditHistory[]>({
      data: mockHistory,
    });
    vi.spyOn(BankHistoryController.prototype, 'handleRequest').mockResolvedValue(
      camsHttpResponse as CamsHttpResponseInit,
    );

    const response = await handler(request, context);

    expect(response).toEqual(azureHttpResponse);
  });

  test('should return error response when controller throws', async () => {
    const request = createMockAzureFunctionRequest({ method: 'GET' });
    const error = new CamsError('BANK-HISTORY-CONTROLLER', {
      message: 'Something went wrong.',
    });
    const { azureHttpResponse, loggerCamsErrorSpy } = buildTestResponseError(error);
    vi.spyOn(BankHistoryController.prototype, 'handleRequest').mockRejectedValue(error);

    const response = await handler(request, context);

    expect(response).toMatchObject(azureHttpResponse);
    expect(loggerCamsErrorSpy).toHaveBeenCalledWith(error);
  });
});
