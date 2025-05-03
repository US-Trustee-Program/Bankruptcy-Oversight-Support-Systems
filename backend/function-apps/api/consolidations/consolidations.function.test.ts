import { ConsolidationOrder } from '../../../../common/src/cams/orders';
import { MockData } from '../../../../common/src/cams/test-utilities/mock-data';
import { CamsHttpRequest } from '../../../lib/adapters/types/http';
import { BadRequestError } from '../../../lib/common-errors/bad-request';
import { OrdersController } from '../../../lib/controllers/orders/orders.controller';
import ContextCreator from '../../azure/application-context-creator';
import {
  buildTestResponseError,
  buildTestResponseSuccess,
  createMockAzureFunctionContext,
  createMockAzureFunctionRequest,
} from '../../azure/testing-helpers';
import handler from './consolidations.function';

describe('Consolidations Function tests', () => {
  const defaultRequestProps: Partial<CamsHttpRequest> = {
    body: {},
    method: 'PUT',
    params: {
      procedure: '',
    },
    url: 'http://domain/api/consolidations',
  };

  const context = createMockAzureFunctionContext();

  jest
    .spyOn(ContextCreator, 'getApplicationContextSession')
    .mockResolvedValue(MockData.getManhattanAssignmentManagerSession());

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('should reject consolidation when procedure == "reject"', async () => {
    const mockConsolidationOrder = MockData.getConsolidationOrder();
    const requestProps = {
      ...defaultRequestProps,
      body: {
        ...mockConsolidationOrder,
        rejectedCases: [mockConsolidationOrder.childCases[0]],
      },
      params: {
        procedure: 'reject',
      },
    };
    const request = createMockAzureFunctionRequest(requestProps);

    const { azureHttpResponse, camsHttpResponse } = buildTestResponseSuccess<ConsolidationOrder[]>({
      data: [mockConsolidationOrder],
    });
    jest
      .spyOn(OrdersController.prototype, 'rejectConsolidation')
      .mockResolvedValue(camsHttpResponse);

    const response = await handler(request, context);

    expect(response).toEqual(azureHttpResponse);
  });

  test('should approve consolidation when procedure == "Approve"', async () => {
    const mockConsolidationOrder = MockData.getConsolidationOrder();

    const requestProps = {
      ...defaultRequestProps,
      params: {
        procedure: 'approve',
      },
    };
    const request = createMockAzureFunctionRequest(requestProps);

    const { azureHttpResponse, camsHttpResponse } = buildTestResponseSuccess<ConsolidationOrder[]>({
      data: [mockConsolidationOrder],
    });

    jest
      .spyOn(OrdersController.prototype, 'approveConsolidation')
      .mockResolvedValue(camsHttpResponse);

    const response = await handler(request, context);

    expect(response).toEqual(azureHttpResponse);
  });

  test('should throw a BadRequestError on invalid procedure request', async () => {
    const requestProps = {
      ...defaultRequestProps,
      params: {
        procedure: 'unsupported',
      },
    };
    const request = createMockAzureFunctionRequest(requestProps);

    const error = new BadRequestError('TEST-MODULE', {
      message: `Could not perform ${requestProps.params.procedure}.`,
    });
    const { azureHttpResponse } = buildTestResponseError(error);

    const response = await handler(request, context);

    expect(response).toEqual(azureHttpResponse);
  });

  test('should throw an UnknownError on bad request', async () => {
    const requestProps = {
      ...defaultRequestProps,
      params: {
        procedure: 'approve',
      },
    };
    const request = createMockAzureFunctionRequest(requestProps);

    const error = new Error('consolidation-test');
    const { azureHttpResponse } = buildTestResponseError(error);
    jest.spyOn(OrdersController.prototype, 'approveConsolidation').mockRejectedValue(error);

    const response = await handler(request, context);
    expect(response).toEqual(azureHttpResponse);
  });
});
