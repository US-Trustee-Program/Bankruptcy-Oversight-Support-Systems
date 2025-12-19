import { vi } from 'vitest';
import { CamsError } from '../../../lib/common-errors/cams-error';
import handler from './lists.function';
import {
  buildTestResponseError,
  buildTestResponseSuccess,
  createMockAzureFunctionContext,
  createMockAzureFunctionRequest,
} from '../../azure/testing-helpers';
import { ListsController } from '../../../lib/controllers/lists/lists.controller';
import { BankList, BankruptcySoftwareList } from '../../../../common/src/cams/lists';

describe('Lists Function tests', () => {
  let request;
  let context;

  beforeEach(() => {
    request = createMockAzureFunctionRequest();
    context = createMockAzureFunctionContext();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should set successful response for bank list', async () => {
    const mockBanksList: BankList = [
      { _id: '1', list: 'banks', key: 'bank1', value: 'Bank One' },
      { _id: '2', list: 'banks', key: 'bank2', value: 'Bank Two' },
    ];

    const { camsHttpResponse, azureHttpResponse } = buildTestResponseSuccess<BankList>({
      data: mockBanksList,
    });

    vi.spyOn(ListsController.prototype, 'handleRequest').mockResolvedValue(camsHttpResponse);

    // Set up the request with listName parameter
    request.params = { listName: 'banks' };

    const response = await handler(request, context);

    expect(response).toEqual(azureHttpResponse);
  });

  test('should set successful response for bankruptcy software list', async () => {
    const mockSoftwareList: BankruptcySoftwareList = [
      { _id: '1', list: 'bankruptcy-software', key: 'software1', value: 'Software One' },
      { _id: '2', list: 'bankruptcy-software', key: 'software2', value: 'Software Two' },
    ];

    const { camsHttpResponse, azureHttpResponse } =
      buildTestResponseSuccess<BankruptcySoftwareList>({
        data: mockSoftwareList,
      });

    vi.spyOn(ListsController.prototype, 'handleRequest').mockResolvedValue(camsHttpResponse);

    // Set up the request with listName parameter
    request.params = { listName: 'bankruptcy-software' };

    const response = await handler(request, context);

    expect(response).toEqual(azureHttpResponse);
  });

  test('should set error response when controller throws error', async () => {
    const error = new CamsError('MOCK_LISTS_CONTROLLER', {
      message: 'Some expected CAMS error.',
    });

    const { azureHttpResponse, loggerCamsErrorSpy } = buildTestResponseError(error);
    vi.spyOn(ListsController.prototype, 'handleRequest').mockRejectedValue(error);

    const response = await handler(request, context);

    expect(response).toMatchObject(azureHttpResponse);
    expect(loggerCamsErrorSpy).toHaveBeenCalledWith(error);
  });
});
