import { UnknownError } from '../lib/common-errors/unknown-error';
import * as httpResponseModule from '../lib/adapters/utils/http-response';
import { AttorneysController } from '../lib/controllers/attorneys/attorneys.controller';
import { CamsError } from '../lib/common-errors/cams-error';
import ContextCreator from '../lib/adapters/utils/application-context-creator';
import { MockData } from '../../../common/src/cams/test-utilities/mock-data';
import { createMockAzureFunctionRequest } from '../azure/functions';
import AttorneyList from '../lib/use-cases/attorneys';
import handler from './attorneys.function';
import { createMockApplicationContext } from '../lib/testing/testing-utilities';
import { ApplicationContext } from '../lib/adapters/types/basic';
import { InvocationContext } from '@azure/functions';
import { ResponseBodySuccess } from '../../../common/src/api/response';
import { AttorneyUser } from '../../../common/src/cams/users';

describe('Attorneys Azure Function tests', () => {
  const request = createMockAzureFunctionRequest();
  let appContext: ApplicationContext;
  const context = new InvocationContext();

  beforeEach(async () => {
    jest
      .spyOn(ContextCreator, 'getApplicationContextSession')
      .mockResolvedValue(MockData.getCamsSession());
    jest.spyOn(AttorneyList.prototype, 'getAttorneyList').mockResolvedValue([]);
    appContext = await createMockApplicationContext();
  });

  test('Should return an HTTP Error if getAttorneyList() throws an unexpected error', async () => {
    const attorneysController = new AttorneysController(appContext);
    jest
      .spyOn(Object.getPrototypeOf(attorneysController), 'getAttorneyList')
      .mockImplementation(() => {
        throw new Error();
      });

    const httpErrorSpy = jest.spyOn(httpResponseModule, 'httpError');

    await handler(request, context);

    expect(httpErrorSpy).toHaveBeenCalledWith(expect.any(UnknownError));
  });

  test('Should return an HTTP Error if getAttorneyList() throws a CamsError error', async () => {
    jest
      .spyOn(AttorneysController.prototype, 'getAttorneyList')
      .mockRejectedValue(new CamsError('fake-module'));

    const httpErrorSpy = jest.spyOn(httpResponseModule, 'httpError');

    await handler(request, context);

    expect(httpErrorSpy).toHaveBeenCalledWith(expect.any(CamsError));
    expect(httpErrorSpy).not.toHaveBeenCalledWith(expect.any(UnknownError));
  });

  test('should return success with a list of attorneys', async () => {
    const attorneys = MockData.buildArray(MockData.getAttorneyUser, 4);
    const mockResponse: ResponseBodySuccess<AttorneyUser[]> = {
      meta: {
        self: '',
        isPaginated: false,
      },
      isSuccess: true,
      data: attorneys,
    };
    jest.spyOn(AttorneysController.prototype, 'getAttorneyList').mockResolvedValue(mockResponse);

    const response = await handler(request, context);
    expect(response.jsonBody).toEqual(mockResponse);
  });
});
