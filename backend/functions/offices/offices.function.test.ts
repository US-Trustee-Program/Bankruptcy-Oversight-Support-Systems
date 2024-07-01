import httpTrigger from '../offices/offices.function';
import { CamsError } from '../lib/common-errors/cams-error';
import { createMockAzureFunctionRequest } from '../azure/functions';

let getOffices;

jest.mock('../lib/controllers/offices/offices.controller', () => {
  return {
    OfficesController: jest.fn().mockImplementation(() => {
      return {
        getOffices,
      };
    }),
  };
});

describe('offices Function tests', () => {
  const request = createMockAzureFunctionRequest();
  const context = require('azure-function-context-mock');

  test('should set successful response', async () => {
    getOffices = jest.fn().mockImplementation(() => {
      return Promise.resolve({ success: true, body: [] });
    });

    const expectedResponseBody = {
      success: true,
      body: [],
    };

    await httpTrigger(context, request);

    expect(context.res.body).toEqual(expectedResponseBody);
  });

  test('should set error response', async () => {
    getOffices = jest.fn().mockImplementation(() => {
      throw new CamsError('MOCK_OFFICES_CONTROLLER', { message: 'Some expected CAMS error.' });
    });

    const expectedResponseBody = {
      success: false,
      message: 'Some expected CAMS error.',
    };

    await httpTrigger(context, request);

    expect(context.res.body).toEqual(expectedResponseBody);
  });
});
