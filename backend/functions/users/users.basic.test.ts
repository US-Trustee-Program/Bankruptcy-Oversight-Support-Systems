import httpTrigger from './users.function';
import { getProperty } from '../lib/testing/mock-data';
import { applicationContextCreator } from '../lib/adapters/utils/application-context-creator';
const context = require('azure-function-context-mock');

const appContext = applicationContextCreator(context);

jest.mock('dotenv');

describe('Standard User Login Http Trigger tests without class mocks', () => {
  beforeAll(() => {
    process.env = {
      APPINSIGHTS_CONNECTION_STRING: 'TESTSTRING',
    };
    console.log(process.env.APPINSIGHTS_CONNECTION_STRING);
  });
  test('should by default complain about missing first and last name parameters', async () => {
    const request = {
      query: {},
    };

    await httpTrigger(appContext, request);

    expect(appContext.res.body).toEqual({
      error: 'Required parameters absent: first_name and last_name.',
    });
  });

  test('should return success but 0 results when supplied with invalid first and last name.', async () => {
    const request = {
      query: {
        first_name: 'jon',
        last_name: 'doe',
      },
    };

    const responseBody = {
      success: true,
      message: 'user record',
      count: 0,
      body: [],
    };

    await httpTrigger(appContext, request);

    expect(appContext.res.body).toEqual(responseBody);
  });

  test('should return 1 user record when supplied with parameters "Test" "Person".', async () => {
    const request = {
      query: {
        first_name: 'Test',
        last_name: 'Person',
      },
    };

    const userListRecords = await getProperty('users', 'list');
    const body = userListRecords.userList[0];

    const responseBody = {
      success: true,
      message: 'user record',
      count: 1,
      body: [body],
    };

    await httpTrigger(appContext, request);

    expect(appContext.res.body).toEqual(responseBody);
  });

  test('should return 1 user record when supplied with body "Test" "Person".', async () => {
    const request = {
      query: {},
      body: {
        first_name: 'Test',
        last_name: 'Person',
      },
    };

    const userListRecords = await getProperty('users', 'list');
    const body = userListRecords.userList[0];

    const responseBody = {
      success: true,
      message: 'user record',
      count: 1,
      body: [body],
    };

    await httpTrigger(appContext, request);

    expect(appContext.res.body).toEqual(responseBody);
  });
});
