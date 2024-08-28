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
import { CamsResponse } from '../controller-types';
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

const MODULE_NAME = 'ORDERS-CONTROLLER';

export type GetOrdersResponse = CamsResponse<Array<Order>>;
export type GetSuggestedCasesResponse = CamsResponse<Array<CaseSummary>>;
export type PatchOrderResponse = CamsResponse<string>;
export type ManageConsolidationResponse = CamsResponse<ConsolidationOrder[]>;

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
      const orders = await this.useCase.getOrders(context);
      return {
        body: orders,
      };
    } catch (originalError) {
      throw isCamsError(originalError)
        ? originalError
        : new UnknownError(MODULE_NAME, { originalError });
    }
  }

  public async getSuggestedCases(
    context: ApplicationContext,
    caseId: string,
  ): Promise<CamsHttpResponseInit<CaseSummary[]>> {
    try {
      const suggestedCases = await this.useCase.getSuggestedCases(context, caseId);
      return {
        body: suggestedCases,
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
      return;
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
    data: unknown,
  ): Promise<CamsHttpResponseInit<ConsolidationOrder[]>> {
    try {
      if (isConsolidationOrderRejection(data)) {
        if (data.rejectedCases.length == 0) {
          throw new BadRequestError('Missing rejected cases');
        }

        const orders = await this.useCase.rejectConsolidation(context, data);
        const response = {
          body: orders,
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
    data: unknown,
  ): Promise<CamsHttpResponseInit<ConsolidationOrder[]>> {
    try {
      if (isConsolidationOrderApproval(data)) {
        if (!data.consolidationType) {
          throw new BadRequestError('Missing consolidation type');
        }

        if (data.approvedCases.length == 0) {
          throw new BadRequestError('Missing approved cases');
        }

        if (!data.leadCase) {
          throw new BadRequestError('Missing lead case');
        }

        const orders = await this.useCase.approveConsolidation(context, data);
        const response = {
          body: orders,
        };
        return response;
      }
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }
}
