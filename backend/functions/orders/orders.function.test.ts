import { CASE_HISTORY } from '../lib/testing/mock-data/case-history.mock';
import httpTrigger from './orders.function';

const context = require('azure-function-context-mock');

describe('Orders function', () => {
  test('should return a list of orders', async () => {
    const request = {
      params: {},
    };
    const expectedResponseBody = {
      success: true,
      body: CASE_HISTORY,
    };
    process.env = {
      DATABASE_MOCK: 'true',
    };
    await httpTrigger(context, request);
    expect(context.res.body).toEqual(expectedResponseBody);
  });

  test('Should return an error response when an error is encountered', async () => {
    const request = {
      params: {},
    };
    process.env = {
      DATABASE_MOCK: 'true',
    };
    const expectedErrorResponse = {
      success: false,
    };
    await httpTrigger(context, request);
    expect(context.res.body).toMatchObject(expectedErrorResponse);
  });
});
