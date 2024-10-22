/* eslint-disable @typescript-eslint/no-explicit-any */
import { ConsolidationOrdersRepository, OrdersRepository } from '../../use-cases/gateways.types';

export class MockMongoRepository implements ConsolidationOrdersRepository, OrdersRepository {
  update(..._ignore): Promise<void> {
    throw new Error('Method not implemented.');
  }
  search(..._ignore): Promise<[]> {
    throw new Error('Method not implemented.');
  }
  create(..._ignore): Promise<any> {
    throw new Error('Method not implemented.');
  }
  createMany(..._ignore): Promise<any> {
    throw new Error('Method not implemented.');
  }
  read(..._ignore): Promise<any> {
    throw new Error('Method not implemented.');
  }
  delete(..._ignore): Promise<void> {
    throw new Error('Method not implemented.');
  }
  async getTransfers(..._ignore): Promise<unknown[]> {
    throw new Error('Method not implemented.');
  }
}
