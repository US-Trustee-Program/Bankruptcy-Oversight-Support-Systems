import httpTrigger from './users.function';
import { getProperty } from '../lib/testing/mock-data';
const context = require('../lib/testing/default-context');

describe('Standard User Login Http Trigger tests without class mocks', () => {
  test('should by default complain about missing first and last name parameters', async () => {
    const request = {
      query: {},
    };

    await httpTrigger(context, request);

    expect(context.res.body).toEqual({
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

    await httpTrigger(context, request);

    expect(context.res.body).toEqual(responseBody);
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

    await httpTrigger(context, request);

    expect(context.res.body).toEqual(responseBody);
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

    await httpTrigger(context, request);

    expect(context.res.body).toEqual(responseBody);
  });
});
