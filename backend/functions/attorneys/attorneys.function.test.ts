import { UnknownError } from '../lib/common-errors/unknown-error';
import httpTrigger from './attorneys.function';
import * as httpResponseModule from '../lib/adapters/utils/http-response';
import { AttorneysController } from '../lib/controllers/attorneys/attorneys.controller';
import { CamsError } from '../lib/common-errors/cams-error';
import ContextCreator from '../lib/adapters/utils/application-context-creator';
import { MockData } from '../../../common/src/cams/test-utilities/mock-data';
import { createMockAzureFunctionRequest } from '../azure/functions';
import AttorneyList from '../lib/use-cases/attorneys';

describe('Attorneys Azure Function tests', () => {
  const request = createMockAzureFunctionRequest();
  /* eslint-disable-next-line @typescript-eslint/no-require-imports */
  const context = require('azure-function-context-mock');

  beforeEach(async () => {
    jest
      .spyOn(ContextCreator, 'getApplicationContextSession')
      .mockResolvedValue(MockData.getCamsSession());
    jest.spyOn(AttorneyList.prototype, 'getAttorneyList').mockResolvedValue([]);
  });

  test('Should return an HTTP Error if getAttorneyList() throws an unexpected error', async () => {
    const attorneysController = new AttorneysController(context);
    jest
      .spyOn(Object.getPrototypeOf(attorneysController), 'getAttorneyList')
      .mockImplementation(() => {
        throw new Error();
      });

    const httpErrorSpy = jest.spyOn(httpResponseModule, 'httpError');

    await httpTrigger(context, request);

    expect(httpErrorSpy).toHaveBeenCalledWith(expect.any(UnknownError));
  });

  test('Should return an HTTP Error if getAttorneyList() throws a CamsError error', async () => {
    jest
      .spyOn(AttorneysController.prototype, 'getAttorneyList')
      .mockRejectedValue(new CamsError('fake-module'));

    const httpErrorSpy = jest.spyOn(httpResponseModule, 'httpError');

    await httpTrigger(context, request);

    expect(httpErrorSpy).toHaveBeenCalledWith(expect.any(CamsError));
    expect(httpErrorSpy).not.toHaveBeenCalledWith(expect.any(UnknownError));
  });
});
