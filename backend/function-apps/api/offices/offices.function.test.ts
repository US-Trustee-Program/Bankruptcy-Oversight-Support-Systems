import { vi } from 'vitest';
import { CamsError } from '../../../lib/common-errors/cams-error';
import ContextCreator from '../../azure/application-context-creator';
import MockData from '../../../../common/src/cams/test-utilities/mock-data';
import handler from './offices.function';
import {
  buildTestResponseError,
  buildTestResponseSuccess,
  createMockAzureFunctionContext,
  createMockAzureFunctionRequest,
} from '../../azure/testing-helpers';
import { OfficesController } from '../../../lib/controllers/offices/offices.controller';
import { MOCKED_USTP_OFFICES_ARRAY, UstpOfficeDetails } from '../../../../common/src/cams/offices';

describe('offices Function tests', () => {
  let request;
  let context;

  beforeEach(() => {
    request = createMockAzureFunctionRequest();
    context = createMockAzureFunctionContext();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  vi.spyOn(ContextCreator, 'getApplicationContextSession').mockResolvedValue(
    MockData.getManhattanAssignmentManagerSession(),
  );

  test('should set successful response', async () => {
    const bodySuccess: UstpOfficeDetails[] = MOCKED_USTP_OFFICES_ARRAY;

    const { camsHttpResponse, azureHttpResponse } = buildTestResponseSuccess<UstpOfficeDetails[]>({
      data: bodySuccess,
    });

    vi.spyOn(OfficesController.prototype, 'handleRequest').mockResolvedValue(camsHttpResponse);

    const response = await handler(request, context);

    expect(response).toEqual(azureHttpResponse);
  });

  test('should set error response', async () => {
    const error = new CamsError('MOCK_OFFICES_CONTROLLER', {
      message: 'Some expected CAMS error.',
    });

    const { azureHttpResponse, loggerCamsErrorSpy } = buildTestResponseError(error);
    vi.spyOn(OfficesController.prototype, 'handleRequest').mockRejectedValue(error);

    const response = await handler(request, context);

    expect(response).toMatchObject(azureHttpResponse);
    expect(loggerCamsErrorSpy).toHaveBeenCalledWith(error);
  });
});
