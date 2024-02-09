import { ApplicationContext } from '../../adapters/types/basic';
import { CamsError } from '../../common-errors/cams-error';
import { UnknownError } from '../../common-errors/unknown-error';
import {
  getCasesRepository,
  getCasesGateway,
  getOrdersGateway,
  getOrdersRepository,
  getRuntimeStateRepository,
} from '../../factory';
import { OrdersUseCase, SyncOrdersOptions, SyncOrdersStatus } from '../../use-cases/orders/orders';
import { CamsResponse } from '../controller-types';
import { TransferOrderAction } from '../../../../../common/src/cams/orders';
import { TransferOrder } from '../../../../../common/src/cams/orders';
import { CaseSummary } from '../../../../../common/src/cams/cases';

const MODULE_NAME = 'ORDERS-CONTROLLER';

export type GetOrdersResponse = CamsResponse<Array<TransferOrder>>;
export type GetSuggestedCasesResponse = CamsResponse<Array<CaseSummary>>;
export type PatchOrderResponse = CamsResponse<string>;

export class OrdersController {
  private readonly useCase: OrdersUseCase;

  constructor(context: ApplicationContext) {
    this.useCase = new OrdersUseCase(
      getCasesRepository(context),
      getCasesGateway(context),
      getOrdersRepository(context),
      getOrdersGateway(context),
      getRuntimeStateRepository(context),
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
      const result = await this.useCase.updateOrder(context, id, data);
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
}
