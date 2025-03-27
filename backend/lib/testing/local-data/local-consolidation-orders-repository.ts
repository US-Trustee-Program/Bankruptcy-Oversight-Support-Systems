import { ConsolidationOrder } from '../../../../common/src/cams/orders';
import { ConsolidationOrdersRepository } from '../../use-cases/gateways.types';
import { OrdersSearchPredicate } from '../../../../common/src/api/search';
import * as crypto from 'crypto';
import { ApplicationContext } from '../../adapters/types/basic';

export class LocalConsolidationOrdersRepository implements ConsolidationOrdersRepository {
  container: ConsolidationOrder[] = [];

  private static singleton: LocalConsolidationOrdersRepository;

  release() {
    return;
  }

  static getInstance(_context: ApplicationContext) {
    if (!this.singleton) this.singleton = new LocalConsolidationOrdersRepository();
    return this.singleton;
  }

  async search(_predicate?: OrdersSearchPredicate): Promise<ConsolidationOrder[]> {
    return [...this.container];
  }

  async create(data: ConsolidationOrder): Promise<ConsolidationOrder> {
    const doc: ConsolidationOrder = { ...data, id: crypto.randomUUID() };
    this.container.push(doc);
    return doc;
  }

  async delete(id: string) {
    this.container = this.container.filter((doc) => doc.id !== id);
  }

  createMany(_data: ConsolidationOrder[]): Promise<void> {
    return Promise.resolve(undefined);
  }

  read(_id: string, _partitionKey: string): Promise<ConsolidationOrder> {
    return Promise.resolve(undefined);
  }
}
