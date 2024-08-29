import { ApplicationContext } from '../../adapters/types/basic';
import { isCamsError } from '../../common-errors/cams-error';
import { UnknownError } from '../../common-errors/unknown-error';
import {
  getCasesGateway,
  getCasesRepository,
  getConsolidationOrdersRepository,
  getOrdersGateway,
  getOrdersRepository,
  getRuntimeStateRepository,
} from '../../factory';
import { OrdersUseCase, SyncOrdersOptions, SyncOrdersStatus } from '../../use-cases/orders/orders';
import {
  ConsolidationOrder,
  isConsolidationOrderApproval,
  isConsolidationOrderRejection,
  Order,
  TransferOrderAction,
} from '../../../../../common/src/cams/orders';
import { CaseSummary } from '../../../../../common/src/cams/cases';
import { BadRequestError } from '../../common-errors/bad-request';
import { CamsHttpResponseInit } from '../../adapters/utils/http-response';
import { getCamsError } from '../../common-errors/error-utilities';
import HttpStatusCodes from '../../../../../common/src/api/http-status-codes';
import { CamsHttpRequest } from '../../adapters/types/http';

const MODULE_NAME = 'ORDERS-CONTROLLER';

export type GetOrdersResponse = CamsHttpResponseInit<Order[]>;
export type GetSuggestedCasesResponse = CamsHttpResponseInit<CaseSummary[]>;
export type ManageConsolidationResponse = CamsHttpResponseInit<ConsolidationOrder[]>;

export class OrdersController {
  private readonly useCase: OrdersUseCase;

  constructor(context: ApplicationContext) {
    this.useCase = new OrdersUseCase(
      getCasesRepository(context),
      getCasesGateway(context),
      getOrdersRepository(context),
      getOrdersGateway(context),
      getRuntimeStateRepository(context),
      getConsolidationOrdersRepository(context),
    );
  }

  public async getOrders(context: ApplicationContext): Promise<CamsHttpResponseInit<Order[]>> {
    try {
      const data = await this.useCase.getOrders(context);
      return {
        body: { data },
      };
    } catch (originalError) {
      throw isCamsError(originalError)
        ? originalError
        : new UnknownError(MODULE_NAME, { originalError });
    }
  }

  public async getSuggestedCases(
    context: ApplicationContext,
    request: CamsHttpRequest,
  ): Promise<CamsHttpResponseInit<CaseSummary[]>> {
    try {
      const data = await this.useCase.getSuggestedCases(context, request.params.caseId);
      return {
        body: {
          meta: {
            self: request.url,
          },
          data,
        },
      };
    } catch (originalError) {
      throw isCamsError(originalError)
        ? originalError
        : new UnknownError(MODULE_NAME, { originalError });
    }
  }

  public async updateOrder(
    context: ApplicationContext,
    id: string,
    data: TransferOrderAction,
  ): Promise<CamsHttpResponseInit> {
    // TODO: Need to sanitize id and data.
    try {
      await this.useCase.updateTransferOrder(context, id, data);
      return {
        statusCode: HttpStatusCodes.NO_CONTENT,
      };
    } catch (originalError) {
      throw isCamsError(originalError)
        ? originalError
        : new UnknownError(MODULE_NAME, { originalError });
    }
  }

  public async syncOrders(
    context: ApplicationContext,
    options?: SyncOrdersOptions,
  ): Promise<SyncOrdersStatus> {
    try {
      const result = await this.useCase.syncOrders(context, options);
      return result;
    } catch (originalError) {
      throw isCamsError(originalError)
        ? originalError
        : new UnknownError(MODULE_NAME, { originalError });
    }
  }

  public async rejectConsolidation(
    context: ApplicationContext,
    order: unknown,
  ): Promise<CamsHttpResponseInit<ConsolidationOrder[]>> {
    try {
      if (isConsolidationOrderRejection(order)) {
        if (order.rejectedCases.length == 0) {
          throw new BadRequestError('Missing rejected cases');
        }

        const data = await this.useCase.rejectConsolidation(context, order);
        const response = {
          body: { data },
        };
        return response;
      }
    } catch (originalError) {
      throw isCamsError(originalError)
        ? originalError
        : new UnknownError(MODULE_NAME, { originalError });
    }
  }

  public async approveConsolidation(
    context: ApplicationContext,
    order: unknown,
  ): Promise<CamsHttpResponseInit<ConsolidationOrder[]>> {
    try {
      if (isConsolidationOrderApproval(order)) {
        if (!order.consolidationType) {
          throw new BadRequestError('Missing consolidation type');
        }

        if (order.approvedCases.length == 0) {
          throw new BadRequestError('Missing approved cases');
        }

        if (!order.leadCase) {
          throw new BadRequestError('Missing lead case');
        }

        const data = await this.useCase.approveConsolidation(context, order);
        const response = {
          body: { data },
        };
        return response;
      }
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }
}
