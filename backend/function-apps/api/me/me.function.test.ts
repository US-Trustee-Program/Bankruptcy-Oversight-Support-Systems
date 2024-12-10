import {
  buildTestResponseError,
  buildTestResponseSuccess,
  createMockAzureFunctionRequest,
} from '../../azure/testing-helpers';
import ContextCreator from '../../azure/application-context-creator';
import MockData from '../../../../common/src/cams/test-utilities/mock-data';
import { ForbiddenError } from '../../../lib/common-errors/forbidden-error';
import handler from './me.function';
import { InvocationContext } from '@azure/functions';
import { CamsSession } from '../../../../common/src/cams/session';
import { createMockApplicationContext } from '../../../lib/testing/testing-utilities';

describe('me Function test', () => {
  const context = new InvocationContext({
    logHandler: () => {},
    invocationId: 'id',
  });

  const request = createMockAzureFunctionRequest();

  test('should set successful response', async () => {
    const camsContext = await createMockApplicationContext();
    camsContext.session = MockData.getCamsSession();
    jest.spyOn(ContextCreator, 'applicationContextCreator').mockResolvedValue(camsContext);
    const { azureHttpResponse } = buildTestResponseSuccess<CamsSession>({
      data: camsContext.session,
    });
    const response = await handler(request, context);

    expect(response).toMatchObject(azureHttpResponse);
  });

  test('should handle an error response', async () => {
    const error = new ForbiddenError('FUNCTION_TEST');
    jest.spyOn(ContextCreator, 'applicationContextCreator').mockRejectedValue(error);
    const { azureHttpResponse } = buildTestResponseError(error);
    const response = await handler(request, context);

    expect(response).toEqual(azureHttpResponse);
  });
});
