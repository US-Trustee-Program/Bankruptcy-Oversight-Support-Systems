import httpTrigger from './orders.function';
import { ORDERS } from '../lib/testing/mock-data/orders.mock';

const context = require('azure-function-context-mock');

describe('Orders Function tests', () => {
  test.skip('should return a list of orders', async () => {
    const request = {
      params: {},
    };
    const expectedResponseBody = {
      success: true,
      body: ORDERS,
    };
    process.env = {
      DATABASE_MOCK: 'true',
    };
    await httpTrigger(context, request);
    expect(context.res.body).toEqual(expectedResponseBody);
  });
});
