const context = require('azure-function-context-mock');
import httpTrigger from './attorneys.function';
import * as httpModule from '../lib/adapters/utils/http';
import { AttorneysController } from '../lib/adapters/controllers/attorneys.controller';

jest.mock('dotenv');
describe('Attorneys Azure Function tests', () => {
  beforeAll(() => {
    process.env = {
      APPINSIGHTS_CONNECTION_STRING: 'TESTSTRING',
    };
    console.log(process.env.APPINSIGHTS_CONNECTION_STRING);
  });
  it('Should call getAttourneyList with office id if parameter was passed in URL', async () => {
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

  it('Should call getAttourneyList with office id if value was passed to httpTrigger in body', async () => {
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

  it('Should return an HTTP Error if getAttorneyList() throws an error', async () => {
    const attorneysController = new AttorneysController(context);
    jest
      .spyOn(Object.getPrototypeOf(attorneysController), 'getAttorneyList')
      .mockImplementation(() => {
        throw new Error('Test Error');
      });

    const request = {
      query: {
        office_id: '123',
      },
    };

    const httpErrorSpy = jest.spyOn(httpModule, 'httpError');

    await httpTrigger(context, request);

    expect(httpErrorSpy).toHaveBeenCalled();
  });
});
