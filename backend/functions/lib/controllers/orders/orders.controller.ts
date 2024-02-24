import { ApplicationContext } from '../../adapters/types/basic';
import { CamsError } from '../../common-errors/cams-error';
import { UnknownError } from '../../common-errors/unknown-error';
import {
  getCasesGateway,
  getCasesRepository,
  getConsolidationRepository,
  getOrdersGateway,
  getOrdersRepository,
  getRuntimeStateRepository,
} from '../../factory';
import { OrdersUseCase, SyncOrdersOptions, SyncOrdersStatus } from '../../use-cases/orders/orders';
import { CamsResponse } from '../controller-types';
import {
  ConsolidationOrder,
  ConsolidationOrderActionApproval,
  ConsolidationOrderActionRejection,
  Order,
  TransferOrderAction,
} from '../../../../../common/src/cams/orders';
import { CaseSummary } from '../../../../../common/src/cams/cases';
import { BadRequestError } from '../../common-errors/bad-request';

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
      getConsolidationRepository(context),
    );
  }

  public async getOrders(context: ApplicationContext): Promise<GetOrdersResponse> {
    try {
      const orders = await this.useCase.getOrders(context);
      return {
        success: true,
        body: orders,
      };
    } catch (originalError) {
      throw originalError instanceof CamsError
        ? originalError
        : new UnknownError(MODULE_NAME, { originalError });
    }
  }

  public async getSuggestedCases(
    context: ApplicationContext,
    caseId: string,
  ): Promise<GetSuggestedCasesResponse> {
    try {
      const suggestedCases = await this.useCase.getSuggestedCases(context, caseId);
      return {
        success: true,
        body: suggestedCases,
      };
    } catch (originalError) {
      throw originalError instanceof CamsError
        ? originalError
        : new UnknownError(MODULE_NAME, { originalError });
    }
  }

  public async updateOrder(
    context: ApplicationContext,
    id: string,
    data: TransferOrderAction,
  ): Promise<PatchOrderResponse> {
    // TODO: Need to sanitize id and data.
    try {
      const result = await this.useCase.updateTransferOrder(context, id, data);
      return {
        success: true,
        body: result,
      };
    } catch (originalError) {
      throw originalError instanceof CamsError
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
      throw originalError instanceof CamsError
        ? originalError
        : new UnknownError(MODULE_NAME, { originalError });
    }
  }

  public async rejectConsolidation(
    context: ApplicationContext,
    data: ConsolidationOrderActionRejection,
  ): Promise<ManageConsolidationResponse> {
    try {
      if (data.rejectedCases.length == 0) {
        throw new BadRequestError('Missing rejected cases');
      }

      const orders = await this.useCase.rejectConsolidation(context, data);
      const response: ManageConsolidationResponse = {
        success: true,
        body: orders,
      };
      return response;
    } catch (originalError) {
      throw originalError instanceof CamsError
        ? originalError
        : new UnknownError(MODULE_NAME, { originalError });
    }
  }

  public async approveConsolidation(
    context: ApplicationContext,
    data: ConsolidationOrderActionApproval,
  ): Promise<ManageConsolidationResponse> {
    try {
      if (data.approvedCases.length == 0) {
        throw new BadRequestError('Missing approved cases');
      }

      if (!data.leadCase) {
        throw new BadRequestError('Missing lead case');
      }

      const orders = await this.useCase.approveConsolidation(context, data);
      const response: ManageConsolidationResponse = {
        success: true,
        body: orders,
      };
      return response;
    } catch (originalError) {
      throw originalError instanceof CamsError
        ? originalError
        : new UnknownError(MODULE_NAME, { originalError });
    }
  }
}
