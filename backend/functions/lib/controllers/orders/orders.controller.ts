import { ApplicationContext } from '../../adapters/types/basic';
import { CamsError } from '../../common-errors/cams-error';
import { UnknownError } from '../../common-errors/unknown-error';
import { getOrdersRepository } from '../../factory';
import { OrdersUseCase } from '../../use-cases/orders/orders';
import { Order } from '../../use-cases/orders/orders.model';
import { CamsResponse } from '../controller-types';

const MODULE_NAME = 'ORDERS-CONTROLLER';

type GetOrdersResponse = CamsResponse<Array<Order>>;

export class OrdersController {
  private readonly useCase: OrdersUseCase;

  constructor(context: ApplicationContext) {
    this.useCase = new OrdersUseCase(getOrdersRepository(context));
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
}
