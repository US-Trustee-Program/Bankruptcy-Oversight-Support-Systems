import httpTrigger from '../offices/offices.function';
import { CamsError } from '../lib/common-errors/cams-error';
import { mockCamsHttpRequest } from '../lib/testing/mock-data/cams-http-request-helper';
import { ApplicationContext } from '../lib/adapters/types/basic';
import { createMockApplicationContext } from '../lib/testing/testing-utilities';

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
  let context: ApplicationContext;

  beforeEach(async () => {
    context = await createMockApplicationContext();
  });

  test('should set successful response', async () => {
    getOffices = jest.fn().mockImplementation(() => {
      return Promise.resolve({ success: true, body: [] });
    });

    const request = mockCamsHttpRequest();

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

    const request = {
      params: {},
    };

    const expectedResponseBody = {
      success: false,
      message: 'Some expected CAMS error.',
    };

    await httpTrigger(context, request);

    expect(context.res.body).toEqual(expectedResponseBody);
  });
});
