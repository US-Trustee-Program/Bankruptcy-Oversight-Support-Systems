import { OrdersGateway } from '../gateways.types';
import { ApplicationContext } from '../../adapters/types/basic';
import { Order } from './orders.model';

export class OrdersUseCase {
  private readonly gateway: OrdersGateway;

  constructor(gateway: OrdersGateway) {
    this.gateway = gateway;
  }

  public async getOrders(context: ApplicationContext): Promise<Array<Order>> {
    return this.gateway.getOrders(context);
  }
}
