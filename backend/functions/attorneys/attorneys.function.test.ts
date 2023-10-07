import { UnknownError } from '../lib/common-errors/unknown-error';

const context = require('azure-function-context-mock');
import httpTrigger from './attorneys.function';
import * as httpResponseModule from '../lib/adapters/utils/http-response';
import { AttorneysController } from '../lib/adapters/controllers/attorneys.controller';
import { CamsError } from '../lib/common-errors/cams-error';
import clearAllMocks = jest.clearAllMocks;

describe('Attorneys Azure Function tests', () => {
  beforeEach(() => {
    clearAllMocks();
  });

  it('Should call getAttorneyList with office id if parameter was passed in URL', async () => {
    const officeId = '123';
    const request = {
      query: {
        office_id: officeId,
      },
    };

    const attorneysController = new AttorneysController(context);
    const attorneysListSpy = jest.spyOn(
      Object.getPrototypeOf(attorneysController),
      'getAttorneyList',
    );

    await httpTrigger(context, request);

    expect(attorneysListSpy).toHaveBeenCalledWith(expect.objectContaining({ officeId }));
  });

  it('Should call getAttorneyList with office id if value was passed to httpTrigger in body', async () => {
    const officeId = '123';
    const request = {
      query: {},
      body: {
        office_id: officeId,
      },
    };

    const attorneysController = new AttorneysController(context);
    const attorneysListSpy = jest.spyOn(
      Object.getPrototypeOf(attorneysController),
      'getAttorneyList',
    );

    await httpTrigger(context, request);

    expect(attorneysListSpy).toHaveBeenCalledWith(expect.objectContaining({ officeId }));
  });

  it('Should return an HTTP Error if getAttorneyList() throws an unexpected error', async () => {
    const attorneysController = new AttorneysController(context);
    jest
      .spyOn(Object.getPrototypeOf(attorneysController), 'getAttorneyList')
      .mockImplementation(() => {
        throw new Error();
      });

    const request = {
      query: {
        office_id: '123',
      },
    };

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

    const request = {
      query: {
        office_id: '123',
      },
    };

    const httpErrorSpy = jest.spyOn(httpResponseModule, 'httpError');

    await httpTrigger(context, request);

    expect(httpErrorSpy).toHaveBeenCalledWith(expect.any(CamsError));
    expect(httpErrorSpy).not.toHaveBeenCalledWith(expect.any(UnknownError));
  });
});
