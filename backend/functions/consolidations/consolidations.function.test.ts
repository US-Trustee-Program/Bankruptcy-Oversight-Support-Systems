import httpTrigger from './consolidations.function';
import { MockData } from '../../../common/src/cams/test-utilities/mock-data';
import { createMockAzureFunctionRequest, createMockAzureFunctionContext } from '../azure/functions';

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
  const request = createMockAzureFunctionRequest({
    params: {
      procedure: '',
    },
    method: 'PUT',
    body: {},
  });

  const context = createMockAzureFunctionContext();

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('should reject consolidation when procedure == "reject"', async () => {
    const mockConsolidationOrder = MockData.getConsolidationOrder();
    rejectConsolidation.mockResolvedValue({ success: true, body: [mockConsolidationOrder] });
    const requestOverride = {
      ...request,
      params: {
        procedure: 'reject',
      },
      body: {
        ...mockConsolidationOrder,
        rejectedCases: [mockConsolidationOrder.childCases[0]],
      },
    };

    const expectedResponseBody = {
      success: true,
      body: [mockConsolidationOrder],
    };
    await httpTrigger(context, requestOverride);
    expect(context.res.body).toEqual(expectedResponseBody);
  });

  test('should approve consolidation when procedure == "Approve"', async () => {
    const mockConsolidationOrder = [MockData.getConsolidationOrder()];
    approveConsolidation.mockResolvedValue({ success: true, body: [mockConsolidationOrder] });
    const expectedResponseBody = {
      success: true,
      body: [mockConsolidationOrder],
    };
    const requestOverride = {
      ...request,
      params: {
        procedure: 'approve',
      },
    };
    await httpTrigger(context, requestOverride);

    expect(context.res.body).toEqual(expectedResponseBody);
  });

  test('should throw a BadRequestError on invalid procedure request', async () => {
    const requestOverride = {
      ...request,
      params: {
        procedure: 'unsupported',
      },
    };
    await httpTrigger(context, requestOverride);
    expect(context.res.statusCode).toEqual(400);
    expect(context.res.body.success).toBeFalsy();
  });

  test('should throw an UnknownError on bad request', async () => {
    approveConsolidation.mockRejectedValue('consolidation-test');
    const requestOverride = {
      ...request,
      params: {
        procedure: 'approve',
      },
    };
    await httpTrigger(context, requestOverride);
    expect(context.res.statusCode).toEqual(500);
    expect(context.res.body.success).toBeFalsy();
  });
});
