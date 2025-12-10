import { vi } from 'vitest';
import { CamsError } from '../../../lib/common-errors/cams-error';
import handler from './courts.function';
import {
  buildTestResponseError,
  buildTestResponseSuccess,
  createMockAzureFunctionContext,
  createMockAzureFunctionRequest,
} from '../../azure/testing-helpers';
import { CourtsController } from '../../../lib/controllers/courts/courts.controller';
import { CourtDivisionDetails } from '../../../../common/src/cams/courts';
import { COURT_DIVISIONS } from '../../../../common/src/cams/test-utilities/courts.mock';

describe('Courts Function tests', () => {
  let request;
  let context;

  beforeEach(() => {
    request = createMockAzureFunctionRequest();
    context = createMockAzureFunctionContext();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should set successful response', async () => {
    const bodySuccess: CourtDivisionDetails[] = COURT_DIVISIONS;

    const { camsHttpResponse, azureHttpResponse } = buildTestResponseSuccess<
      CourtDivisionDetails[]
    >({
      data: bodySuccess,
    });

    vi.spyOn(CourtsController.prototype, 'handleRequest').mockResolvedValue(camsHttpResponse);

    const response = await handler(request, context);

    expect(response).toEqual(azureHttpResponse);
  });

  test('should set error response', async () => {
    const error = new CamsError('MOCK_COURTS_CONTROLLER', {
      message: 'Some expected CAMS error.',
    });

    const { azureHttpResponse, loggerCamsErrorSpy } = buildTestResponseError(error);
    vi.spyOn(CourtsController.prototype, 'handleRequest').mockRejectedValue(error);

    const response = await handler(request, context);

    expect(response).toMatchObject(azureHttpResponse);
    expect(loggerCamsErrorSpy).toHaveBeenCalledWith(error);
  });
});
