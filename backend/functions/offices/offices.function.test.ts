import { CamsError } from '../lib/common-errors/cams-error';
import ContextCreator from '../azure/application-context-creator';
import MockData from '../../../common/src/cams/test-utilities/mock-data';
import handler from './offices.function';
import {
  buildTestResponseError,
  buildTestResponseSuccess,
  createMockAzureFunctionContext,
  createMockAzureFunctionRequest,
} from '../azure/testing-helpers';
import { OfficesController } from '../lib/controllers/offices/offices.controller';
import { USTP_OFFICES_ARRAY, UstpOfficeDetails } from '../../../common/src/cams/courts';

describe('offices Function tests', () => {
  let request;
  let context;

  beforeEach(() => {
    request = createMockAzureFunctionRequest();
    context = createMockAzureFunctionContext();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  jest
    .spyOn(ContextCreator, 'getApplicationContextSession')
    .mockResolvedValue(MockData.getManhattanAssignmentManagerSession());

  test('should set successful response', async () => {
    const bodySuccess: UstpOfficeDetails[] = USTP_OFFICES_ARRAY;

    const { camsHttpResponse, azureHttpResponse } = buildTestResponseSuccess<UstpOfficeDetails[]>({
      data: bodySuccess,
    });

    jest.spyOn(OfficesController.prototype, 'handleRequest').mockResolvedValue(camsHttpResponse);

    const response = await handler(request, context);

    expect(response).toEqual(azureHttpResponse);
  });

  test('should set error response', async () => {
    const error = new CamsError('MOCK_OFFICES_CONTROLLER', {
      message: 'Some expected CAMS error.',
    });

    const { azureHttpResponse, loggerCamsErrorSpy } = buildTestResponseError(error);
    jest.spyOn(OfficesController.prototype, 'handleRequest').mockRejectedValue(error);

    const response = await handler(request, context);

    expect(response).toMatchObject(azureHttpResponse);
    expect(loggerCamsErrorSpy).toHaveBeenCalledWith(error);
  });
});
