import { CamsError } from '../lib/common-errors/cams-error';
import ContextCreator from '../azure/application-context-creator';
import MockData from '../../../common/src/cams/test-utilities/mock-data';
import handler from './courts.function';
import {
  buildTestResponseError,
  buildTestResponseSuccess,
  createMockAzureFunctionContext,
  createMockAzureFunctionRequest,
} from '../azure/testing-helpers';
import { CourtsController } from '../lib/controllers/courts/courts.controller';
import { CourtDivisionDetails } from '../../../common/src/cams/courts';
import { COURT_DIVISIONS } from '../../../common/src/cams/test-utilities/courts.mock';

describe('Courts Function tests', () => {
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
    const bodySuccess: CourtDivisionDetails[] = COURT_DIVISIONS;

    const { camsHttpResponse, azureHttpResponse } = buildTestResponseSuccess<
      CourtDivisionDetails[]
    >({
      data: bodySuccess,
    });

    jest.spyOn(CourtsController.prototype, 'handleRequest').mockResolvedValue(camsHttpResponse);

    const response = await handler(request, context);

    expect(response).toEqual(azureHttpResponse);
  });

  test('should set error response', async () => {
    const error = new CamsError('MOCK_OFFICES_CONTROLLER', {
      message: 'Some expected CAMS error.',
    });

    const { azureHttpResponse, loggerCamsErrorSpy } = buildTestResponseError(error);
    jest.spyOn(CourtsController.prototype, 'handleRequest').mockRejectedValue(error);

    const response = await handler(request, context);

    expect(response).toMatchObject(azureHttpResponse);
    expect(loggerCamsErrorSpy).toHaveBeenCalledWith(error);
  });
});
