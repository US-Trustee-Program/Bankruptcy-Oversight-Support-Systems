import httpTrigger from './consolidations.function';
import { MockData } from '../../../common/src/cams/test-utilities/mock-data';

const context = require('azure-function-context-mock');

const rejectConsolidation = jest.fn();
const approveConsolidation = jest.fn();

jest.mock('../lib/controllers/orders/orders.controller', () => {
  return {
    OrdersController: jest.fn().mockImplementation(() => {
      return {
        rejectConsolidation,
        approveConsolidation,
      };
    }),
  };
});

describe('Consolidations Function tests', () => {
  test('should reject consolidation when procedure == "reject"', async () => {
    const mockConsolidationOrder = MockData.getConsolidationOrder();
    rejectConsolidation.mockImplementation(() => {
      return Promise.resolve({ success: true, body: [mockConsolidationOrder] });
    });
    const request = {
      params: {
        procedure: 'reject',
      },
      body: {
        ...mockConsolidationOrder,
        rejectedCases: [mockConsolidationOrder.childCases[0]],
      },
      method: 'PATCH',
    };
    const expectedResponseBody = {
      success: true,
      body: [mockConsolidationOrder],
    };
    process.env = {
      DATABASE_MOCK: 'true',
    };
    await httpTrigger(context, request);
    expect(context.res.body).toEqual(expectedResponseBody);
  });

  test('should reject consolidation when procedure == "Approve"', async () => {
    const mockConsolidationOrder = [MockData.getConsolidationOrder()];
    approveConsolidation.mockImplementation(() => {
      return Promise.resolve({ success: true, body: [mockConsolidationOrder] });
    });
    const request = {
      params: {
        procedure: 'approve',
      },
      method: 'PATCH',
    };
    const expectedResponseBody = {
      success: true,
      body: [mockConsolidationOrder],
    };
    process.env = {
      DATABASE_MOCK: 'true',
    };
    await httpTrigger(context, request);
    expect(context.res.body).toEqual(expectedResponseBody);
  });

  test('should throw an BadRequestError on invalid procedure request', async () => {
    const request = {
      params: {
        procedure: 'unsupported',
      },
      method: 'PATCH',
    };
    await httpTrigger(context, request);
    expect(context.res.statusCode).toEqual(400);
    expect(context.res.body.success).toBeFalsy();
  });

  test('should throw an UnknownError on bad request', async () => {
    approveConsolidation.mockImplementation(() => {
      throw new Error('consolidation-test');
    });
    const request = {
      params: {
        procedure: 'approve',
      },
      method: 'PATCH',
    };
    await httpTrigger(context, request);
    expect(context.res.statusCode).toEqual(500);
    expect(context.res.body.success).toBeFalsy();
  });
});
