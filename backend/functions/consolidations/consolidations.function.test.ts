import httpTrigger from './consolidations.function';
import { MockData } from '../../../common/src/cams/test-utilities/mock-data';

const context = require('azure-function-context-mock');

const rejectConsolidation = jest
  .fn()
  .mockRejectedValue('Set up the desired behavior for your test.');
const approveConsolidation = jest
  .fn()
  .mockRejectedValue('Set up the desired behavior for your test.');

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
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('should reject consolidation when procedure == "reject"', async () => {
    const mockConsolidationOrder = MockData.getConsolidationOrder();
    rejectConsolidation.mockResolvedValue({ success: true, body: [mockConsolidationOrder] });
    const request = {
      params: {
        procedure: 'reject',
      },
      body: {
        ...mockConsolidationOrder,
        rejectedCases: [mockConsolidationOrder.childCases[0]],
      },
      method: 'PUT',
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

  test('should approve consolidation when procedure == "Approve"', async () => {
    process.env = {
      DATABASE_MOCK: 'true',
    };
    const mockConsolidationOrder = [MockData.getConsolidationOrder()];
    approveConsolidation.mockResolvedValue({ success: true, body: [mockConsolidationOrder] });
    const expectedResponseBody = {
      success: true,
      body: [mockConsolidationOrder],
    };
    const request = {
      params: {
        procedure: 'approve',
      },
      method: 'PUT',
    };
    await httpTrigger(context, request);

    expect(context.res.body).toEqual(expectedResponseBody);
  });

  test('should throw a BadRequestError on invalid procedure request', async () => {
    const request = {
      params: {
        procedure: 'unsupported',
      },
      method: 'PUT',
    };
    await httpTrigger(context, request);
    expect(context.res.statusCode).toEqual(400);
    expect(context.res.body.success).toBeFalsy();
  });

  test('should throw an UnknownError on bad request', async () => {
    approveConsolidation.mockRejectedValue('consolidation-test');
    const request = {
      params: {
        procedure: 'approve',
      },
      method: 'PUT',
    };
    await httpTrigger(context, request);
    expect(context.res.statusCode).toEqual(500);
    expect(context.res.body.success).toBeFalsy();
  });
});
