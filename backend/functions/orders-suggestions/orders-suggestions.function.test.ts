import httpTrigger from './orders-suggestions.function';
import { CASE_SUMMARIES } from '../lib/testing/mock-data/case-summaries.mock';
import { CamsError } from '../lib/common-errors/cams-error';

const context = require('azure-function-context-mock');

let getSuggestedCases;

jest.mock('../lib/controllers/orders/orders.controller', () => {
  return {
    OrdersController: jest.fn().mockImplementation(() => {
      return {
        getSuggestedCases,
      };
    }),
  };
});

describe('Orders Function tests', () => {
  test('should return a list of orders', async () => {
    getSuggestedCases = jest.fn().mockImplementation(() => {
      return Promise.resolve({ success: true, body: CASE_SUMMARIES });
    });
    const request = {
      params: {},
      method: 'GET',
    };
    const expectedResponseBody = {
      success: true,
      body: CASE_SUMMARIES,
    };
    process.env = {
      DATABASE_MOCK: 'true',
    };
    await httpTrigger(context, request);
    expect(context.res.body).toEqual(expectedResponseBody);
  });

  test('should return error response when error is encountered on get list', async () => {
    const id = '1234567890';
    getSuggestedCases = jest.fn().mockImplementation(() => {
      throw new CamsError('MOCK_ORDERS_CONTROLLER', { message: 'Mocked error' });
    });
    const request = {
      params: { id },
      method: 'GET',
    };
    const expectedErrorResponse = {
      success: false,
      message: 'Mocked error',
    };
    await httpTrigger(context, request);
    expect(context.res.body).toMatchObject(expectedErrorResponse);
  });
});
