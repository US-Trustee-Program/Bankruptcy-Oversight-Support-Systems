import { ApplicationContext } from '../../adapters/types/basic';
import { CamsError } from '../../common-errors/cams-error';
import { UnknownError } from '../../common-errors/unknown-error';
import {
  getCasesRepository,
  getOrdersGateway,
  getOrdersRepository,
  getRuntimeStateRepository,
} from '../../factory';
import { OrdersUseCase, SyncOrdersOptions, SyncOrdersStatus } from '../../use-cases/orders/orders';
import { Order, OrderTransfer } from '../../use-cases/orders/orders.model';
import { CamsResponse } from '../controller-types';

const MODULE_NAME = 'ORDERS-CONTROLLER';

export type GetOrdersResponse = CamsResponse<Array<Order>>;
export type PatchOrderResponse = CamsResponse<string>;

export class OrdersController {
  private readonly useCase: OrdersUseCase;

  constructor(context: ApplicationContext) {
    this.useCase = new OrdersUseCase(
      getCasesRepository(context),
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

  public async updateOrder(
    context: ApplicationContext,
    id: string,
    data: OrderTransfer,
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
