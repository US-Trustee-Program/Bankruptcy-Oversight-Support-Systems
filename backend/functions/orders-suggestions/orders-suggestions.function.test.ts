import httpTrigger from './orders-suggestions.function';
import { CASE_SUMMARIES } from '../lib/testing/mock-data/case-summaries.mock';
import { CamsError } from '../lib/common-errors/cams-error';
import { createMockApplicationContext } from '../lib/testing/testing-utilities';
import { ApplicationContext } from '../lib/adapters/types/basic';

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

describe('Orders suggestions function tests', () => {
  let context: ApplicationContext;

  beforeEach(async () => {
    context = await createMockApplicationContext();
  });

  test('should return a list of suggested cases', async () => {
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
    await httpTrigger(context, request);
    expect(context.res.body).toEqual(expectedResponseBody);
  });

  test('should return error response when error is encountered', async () => {
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
