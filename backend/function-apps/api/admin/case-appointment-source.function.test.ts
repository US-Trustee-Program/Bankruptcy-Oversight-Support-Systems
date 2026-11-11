import { InvocationContext } from '@azure/functions';
import ContextCreator from '../../azure/application-context-creator';
import { CaseAppointmentSourceController } from '../../../lib/controllers/admin/case-appointment-source.controller';
import {
  buildTestResponseError,
  buildTestResponseSuccess,
  createMockAzureFunctionRequest,
} from '../../azure/testing-helpers';
import { createMockApplicationContext } from '../../../lib/testing/testing-utilities';
import handler from './case-appointment-source.function';

describe('Case Appointment Source Function tests', () => {
  const invocationContext = new InvocationContext();

  beforeEach(async () => {
    const appContext = await createMockApplicationContext();
    vi.spyOn(ContextCreator, 'applicationContextCreator').mockResolvedValue(appContext);
    vi.spyOn(ContextCreator, 'getApplicationContextSession').mockResolvedValue(appContext.session);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should return success response', async () => {
    const request = createMockAzureFunctionRequest({ method: 'GET' });
    const { camsHttpResponse, azureHttpResponse } = buildTestResponseSuccess();
    vi.spyOn(CaseAppointmentSourceController.prototype, 'handleRequest').mockResolvedValue(
      camsHttpResponse,
    );
    const response = await handler(request, invocationContext);
    expect(response).toEqual(azureHttpResponse);
  });

  test('should return failure response', async () => {
    const request = createMockAzureFunctionRequest({ method: 'GET' });
    const error = new Error('some error');
    const { azureHttpResponse } = buildTestResponseError(error);
    vi.spyOn(CaseAppointmentSourceController.prototype, 'handleRequest').mockRejectedValue(error);
    const response = await handler(request, invocationContext);
    expect(response).toEqual(azureHttpResponse);
  });
});
