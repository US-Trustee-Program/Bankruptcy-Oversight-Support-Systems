import { ConsolidationOrder } from '../../../../../common/src/cams/orders';
import { ApplicationContext } from '../../adapters/types/basic';
import { ConsolidationOrdersRepository } from '../../use-cases/gateways.types';
import { OrdersSearchPredicate } from '../../../../../common/src/api/search';
import * as crypto from 'crypto';

export class LocalConsolidationOrdersRepository implements ConsolidationOrdersRepository {
  container: ConsolidationOrder[] = [];

  async search(
    _context: ApplicationContext,
    _predicate?: OrdersSearchPredicate,
  ): Promise<ConsolidationOrder[]> {
    return [...this.container];
  }

  async create(
    _context: ApplicationContext,
    data: ConsolidationOrder,
  ): Promise<ConsolidationOrder> {
    const doc: ConsolidationOrder = { ...data, id: crypto.randomUUID() };
    this.container.push(doc);
    return doc;
  }

  async delete(_context: ApplicationContext, id: string, _partitionKey: string) {
    this.container = this.container.filter((doc) => doc.id !== id);
  }

  createMany(_context: ApplicationContext, _data: ConsolidationOrder[]): Promise<void> {
    return Promise.resolve(undefined);
  }

  read(
    _context: ApplicationContext,
    _id: string,
    _partitionKey: string,
  ): Promise<ConsolidationOrder> {
    return Promise.resolve(undefined);
  }
}
