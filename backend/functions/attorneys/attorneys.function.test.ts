import { UnknownError } from '../lib/common-errors/unknown-error';
import httpTrigger from './attorneys.function';
import * as httpResponseModule from '../lib/adapters/utils/http-response';
import { AttorneysController } from '../lib/controllers/attorneys/attorneys.controller';
import { CamsError } from '../lib/common-errors/cams-error';
import * as ContextCreator from '../lib/adapters/utils/application-context-creator';
import { MockData } from '../../../common/src/cams/test-utilities/mock-data';
import { createMockApplicationContext } from '../lib/testing/testing-utilities';
import { ApplicationContext } from '../lib/adapters/types/basic';

describe('Attorneys Azure Function tests', () => {
  let request;
  const officeId = '123';
  let context: ApplicationContext;

  beforeEach(async () => {
    context = await createMockApplicationContext();
    request = {
      query: {
        office_id: officeId,
      },
    };
    context.req = {
      ...context.req,
      ...request,
    };

    jest
      .spyOn(ContextCreator, 'getApplicationContextSession')
      .mockResolvedValue(MockData.getCamsSession());
  });

  it('Should call getAttorneyList with office id if parameter was passed in URL', async () => {
    const attorneysController = new AttorneysController(context);
    const attorneysListSpy = jest.spyOn(
      Object.getPrototypeOf(attorneysController),
      'getAttorneyList',
    );

    await httpTrigger(context, request);

    expect(attorneysListSpy).toHaveBeenCalledWith(expect.objectContaining({ officeId }));
  });

  it('Should call getAttorneyList with office id if value was passed to httpTrigger in body', async () => {
    const requestOverride = {
      ...request,
      query: {},
      body: {
        office_id: officeId,
      },
    };
    context.req = {
      ...context.req,
      ...requestOverride,
    };

    const attorneysController = new AttorneysController(context);
    const attorneysListSpy = jest.spyOn(
      Object.getPrototypeOf(attorneysController),
      'getAttorneyList',
    );

    await httpTrigger(context, requestOverride);

    expect(attorneysListSpy).toHaveBeenCalledWith(expect.objectContaining({ officeId }));
  });

  it('Should return an HTTP Error if getAttorneyList() throws an unexpected error', async () => {
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

  it('Should return an HTTP Error if getAttorneyList() throws a CamsError error', async () => {
    const attorneysController = new AttorneysController(context);
    jest
      .spyOn(Object.getPrototypeOf(attorneysController), 'getAttorneyList')
      .mockImplementation(() => {
        throw new CamsError('fake-module');
      });

    const httpErrorSpy = jest.spyOn(httpResponseModule, 'httpError');

    await httpTrigger(context, request);

    expect(httpErrorSpy).toHaveBeenCalledWith(expect.any(CamsError));
    expect(httpErrorSpy).not.toHaveBeenCalledWith(expect.any(UnknownError));
  });
});
