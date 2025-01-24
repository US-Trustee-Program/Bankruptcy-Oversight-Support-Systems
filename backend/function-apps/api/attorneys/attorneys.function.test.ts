import { AttorneysController } from '../../../lib/controllers/attorneys/attorneys.controller';
import { CamsError } from '../../../lib/common-errors/cams-error';
import { MockData } from '../../../../common/src/cams/test-utilities/mock-data';
import {
  buildTestResponseError,
  buildTestResponseSuccess,
  createMockAzureFunctionRequest,
} from '../../azure/testing-helpers';
import AttorneyList from '../../../lib/use-cases/attorneys/attorneys';
import handler from './attorneys.function';
import { InvocationContext } from '@azure/functions';
import { ResponseBody } from '../../../../common/src/api/response';
import { AttorneyUser } from '../../../../common/src/cams/users';
import ContextCreator from '../../azure/application-context-creator';

describe('Attorneys Azure Function tests', () => {
  const request = createMockAzureFunctionRequest();
  const context = new InvocationContext();

  beforeEach(async () => {
    jest
      .spyOn(ContextCreator, 'getApplicationContextSession')
      .mockResolvedValue(MockData.getCamsSession());
    jest.spyOn(AttorneyList.prototype, 'getAttorneyList').mockResolvedValue([]);
  });

  test('Should return an HTTP Error if getAttorneyList() throws an unexpected error', async () => {
    const error = new Error();
    const { azureHttpResponse } = buildTestResponseError(error);
    jest.spyOn(AttorneysController.prototype, 'handleRequest').mockRejectedValue(error);

    const response = await handler(request, context);

    expect(response).toEqual(azureHttpResponse);
  });

  test('Should return an HTTP Error if getAttorneyList() throws a CamsError error', async () => {
    const error = new CamsError('fake-module');
    const { azureHttpResponse } = buildTestResponseError(error);
    jest.spyOn(AttorneysController.prototype, 'handleRequest').mockRejectedValue(error);

    const response = await handler(request, context);

    expect(response).toEqual(azureHttpResponse);
  });

  test('should return success with a list of attorneys', async () => {
    const attorneys = MockData.buildArray(MockData.getAttorneyUser, 4);
    const body: ResponseBody<AttorneyUser[]> = {
      meta: {
        self: 'self-url',
      },
      data: attorneys,
    };
    const { camsHttpResponse, azureHttpResponse } = buildTestResponseSuccess<AttorneyUser[]>(body);
    jest.spyOn(AttorneysController.prototype, 'handleRequest').mockResolvedValue(camsHttpResponse);

    const response = await handler(request, context);
    expect(response).toEqual(azureHttpResponse);
  });
});
