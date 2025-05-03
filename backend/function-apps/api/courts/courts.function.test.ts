import { CourtDivisionDetails } from '../../../../common/src/cams/courts';
import { COURT_DIVISIONS } from '../../../../common/src/cams/test-utilities/courts.mock';
import { CamsError } from '../../../lib/common-errors/cams-error';
import { CourtsController } from '../../../lib/controllers/courts/courts.controller';
import {
  buildTestResponseError,
  buildTestResponseSuccess,
  createMockAzureFunctionContext,
  createMockAzureFunctionRequest,
} from '../../azure/testing-helpers';
import handler from './courts.function';

describe('Courts Function tests', () => {
  let request;
  let context;

  beforeEach(() => {
    request = createMockAzureFunctionRequest();
    context = createMockAzureFunctionContext();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('should set successful response', async () => {
    const bodySuccess: CourtDivisionDetails[] = COURT_DIVISIONS;

    const { azureHttpResponse, camsHttpResponse } = buildTestResponseSuccess<
      CourtDivisionDetails[]
    >({
      data: bodySuccess,
    });

    jest.spyOn(CourtsController.prototype, 'handleRequest').mockResolvedValue(camsHttpResponse);

    const response = await handler(request, context);

    expect(response).toEqual(azureHttpResponse);
  });

  test('should set error response', async () => {
    const error = new CamsError('MOCK_COURTS_CONTROLLER', {
      message: 'Some expected CAMS error.',
    });

    const { azureHttpResponse, loggerCamsErrorSpy } = buildTestResponseError(error);
    jest.spyOn(CourtsController.prototype, 'handleRequest').mockRejectedValue(error);

    const response = await handler(request, context);

    expect(response).toMatchObject(azureHttpResponse);
    expect(loggerCamsErrorSpy).toHaveBeenCalledWith(error);
  });
});
