import { OrdersRepository } from '../../use-cases/gateways.types';
import { ApplicationContext } from '../../adapters/types/basic';
import { OrdersSearchPredicate } from '../../../../../common/src/api/search';
import { Order, TransferOrderAction } from '../../../../../common/src/cams/orders';

export class MockOrdersRepository implements OrdersRepository {
  async search(_context: ApplicationContext, _predicate?: OrdersSearchPredicate): Promise<Order[]> {
    throw new Error('mock this');
  }

  async read(_context: ApplicationContext, _id: string, _partitionKey: string): Promise<Order> {
    throw new Error('mock this');
  }

  async createMany(_context: ApplicationContext, _orders: Order[]): Promise<Order[]> {
    throw new Error('mock this');
  }

  async update(_context: ApplicationContext, _id: string, _data: TransferOrderAction) {
    throw new Error('mock this');
  }
}
