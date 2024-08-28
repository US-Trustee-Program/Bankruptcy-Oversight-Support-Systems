import { MockData } from '../../../common/src/cams/test-utilities/mock-data';
import { createMockAzureFunctionRequest, createMockAzureFunctionContext } from '../azure/functions';
import handler from './consolidations.function';
import { CamsHttpRequest } from '../lib/adapters/types/http';
import ContextCreator from '../azure/application-context-creator';
import { MANHATTAN } from '../../../common/src/cams/test-utilities/offices.mock';
import { CamsRole } from '../../../common/src/cams/roles';

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
  const defaultRequestProps: Partial<CamsHttpRequest> = {
    params: {
      procedure: '',
    },
    method: 'PUT',
    body: {},
  };

  const context = createMockAzureFunctionContext();

  jest.spyOn(ContextCreator, 'getApplicationContextSession').mockResolvedValue(
    MockData.getCamsSession({
      user: {
        id: 'userId-Bob Jones',
        name: 'Bob Jones',
        offices: [MANHATTAN],
        roles: [CamsRole.CaseAssignmentManager],
      },
    }),
  );

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('should reject consolidation when procedure == "reject"', async () => {
    const mockConsolidationOrder = MockData.getConsolidationOrder();
    rejectConsolidation.mockResolvedValue({ success: true, body: [mockConsolidationOrder] });
    const requestOverride = {
      params: {
        procedure: 'reject',
      },
      body: {
        ...mockConsolidationOrder,
        rejectedCases: [mockConsolidationOrder.childCases[0]],
      },
    };
    const request = createMockAzureFunctionRequest({
      ...defaultRequestProps,
      ...requestOverride,
    });

    const expectedResponseBody = {
      success: true,
      body: [mockConsolidationOrder],
    };

    const response = await handler(request, context);
    expect(response.jsonBody).toEqual(expectedResponseBody);
  });

  test('should approve consolidation when procedure == "Approve"', async () => {
    const mockConsolidationOrder = [MockData.getConsolidationOrder()];
    approveConsolidation.mockResolvedValue({ success: true, body: [mockConsolidationOrder] });
    const expectedResponseBody = {
      success: true,
      body: [mockConsolidationOrder],
    };
    const requestOverride = {
      params: {
        procedure: 'approve',
      },
    };

    const request = createMockAzureFunctionRequest({
      ...defaultRequestProps,
      ...requestOverride,
    });

    const response = await handler(request, context);

    expect(response.jsonBody).toEqual(expectedResponseBody);
  });

  test('should throw a BadRequestError on invalid procedure request', async () => {
    const requestOverride = {
      params: {
        procedure: 'unsupported',
      },
    };
    const request = createMockAzureFunctionRequest({
      ...defaultRequestProps,
      ...requestOverride,
    });

    const response = await handler(request, context);
    expect(response.status).toEqual(400);
    expect(response.jsonBody.success).toBeFalsy();
  });

  test('should throw an UnknownError on bad request', async () => {
    approveConsolidation.mockRejectedValue('consolidation-test');
    const requestOverride = {
      params: {
        procedure: 'approve',
      },
    };
    const request = createMockAzureFunctionRequest({
      ...defaultRequestProps,
      ...requestOverride,
    });

    const response = await handler(request, context);
    expect(response.status).toEqual(500);
    expect(response.jsonBody.success).toBeFalsy();
  });
});
