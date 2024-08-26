import handler from './orders-suggestions.function';
import { CASE_SUMMARIES } from '../lib/testing/mock-data/case-summaries.mock';
import { CamsError } from '../lib/common-errors/cams-error';
import { InvocationContext } from '@azure/functions';
import { createMockAzureFunctionRequest } from '../azure/functions';

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
  const context = new InvocationContext({
    logHandler: () => {},
    invocationId: 'id',
  });

  test('should return a list of suggested cases', async () => {
    getSuggestedCases = jest.fn().mockResolvedValue({ success: true, body: CASE_SUMMARIES });
    const request = createMockAzureFunctionRequest({
      method: 'GET',
    });
    const expectedResponseBody = {
      success: true,
      body: CASE_SUMMARIES,
    };
    const response = await handler(request, context);
    expect(response.jsonBody).toEqual(expectedResponseBody);
    expect(response.status).toEqual(200);
  });

  test('should return error response when error is encountered', async () => {
    const id = '1234567890';
    const message = 'Mocked Error';
    getSuggestedCases = jest
      .fn()
      .mockRejectedValue(new CamsError('MOCK_ORDERS_CONTROLLER', { message }));
    const request = createMockAzureFunctionRequest({
      method: 'GET',
      params: { id },
    });
    const expectedErrorResponse = {
      success: false,
      message,
    };
    const response = await handler(request, context);
    expect(response.jsonBody).toMatchObject(expectedErrorResponse);
    expect(response.status).toEqual(500);
  });
});
