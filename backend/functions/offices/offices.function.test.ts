import { CamsError } from '../lib/common-errors/cams-error';
import ContextCreator from '../azure/application-context-creator';
import MockData from '../../../common/src/cams/test-utilities/mock-data';
import { BUFFALO, DELAWARE, MANHATTAN } from '../../../common/src/cams/test-utilities/offices.mock';
import { CamsRole } from '../../../common/src/cams/roles';
import handler from './offices.function';
import {
  buildTestResponseError,
  buildTestResponseSuccess,
  createMockAzureFunctionContext,
  createMockAzureFunctionRequest,
} from '../azure/testing-helpers';
import { OfficesController } from '../lib/controllers/offices/offices.controller';
import { OfficeDetails } from '../../../common/src/cams/courts';
import { ResponseBodySuccess } from '../../../common/src/api/response';

describe('offices Function tests', () => {
  let request;
  let context;
  const testOffices = [MANHATTAN, DELAWARE, BUFFALO];

  beforeEach(() => {
    request = createMockAzureFunctionRequest();
    context = createMockAzureFunctionContext();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  jest.spyOn(ContextCreator, 'getApplicationContextSession').mockResolvedValue(
    MockData.getCamsSession({
      user: {
        id: 'userId-Bob Jones',
        name: 'Bob Jones',
        offices: [MANHATTAN],
        roles: [CamsRole.CaseAssignmentManager],
      },
    }),
  );

  test('should set successful response', async () => {
    const bodySuccess: ResponseBodySuccess<OfficeDetails[]> = {
      meta: {
        self: '',
        isPaginated: false,
      },
      isSuccess: true,
      data: testOffices,
    };

    const { camsHttpResponse, azureHttpResponse } =
      buildTestResponseSuccess<ResponseBodySuccess<OfficeDetails[]>>(bodySuccess);

    jest.spyOn(OfficesController.prototype, 'getOffices').mockResolvedValue(camsHttpResponse);

    const response = await handler(request, context);

    expect(response).toEqual(azureHttpResponse);
  });

  test('should set error response', async () => {
    const error = new CamsError('MOCK_OFFICES_CONTROLLER', {
      message: 'Some expected CAMS error.',
    });

    const { azureHttpResponse, loggerCamsErrorSpy } = buildTestResponseError(error);
    jest.spyOn(OfficesController.prototype, 'getOffices').mockRejectedValue(error);

    const response = await handler(request, context);

    expect(response).toMatchObject(azureHttpResponse);
    expect(loggerCamsErrorSpy).toHaveBeenCalledWith(error);
  });
});
