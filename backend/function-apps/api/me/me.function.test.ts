import { InvocationContext } from '@azure/functions';

import { CamsSession } from '../../../../common/src/cams/session';
import MockData from '../../../../common/src/cams/test-utilities/mock-data';
import { ForbiddenError } from '../../../lib/common-errors/forbidden-error';
import { MeController } from '../../../lib/controllers/me/me.controller';
import { createMockApplicationContext } from '../../../lib/testing/testing-utilities';
import ContextCreator from '../../azure/application-context-creator';
import {
  buildTestResponseError,
  buildTestResponseSuccess,
  createMockAzureFunctionRequest,
} from '../../azure/testing-helpers';
import handler from './me.function';

describe('me Function test', () => {
  const context = new InvocationContext({
    invocationId: 'id',
    logHandler: () => {},
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
    jest.spyOn(MeController.prototype, 'handleRequest').mockRejectedValue(error);
    const { azureHttpResponse } = buildTestResponseError(error);
    const response = await handler(request, context);

    expect(response).toEqual(azureHttpResponse);
  });
});
