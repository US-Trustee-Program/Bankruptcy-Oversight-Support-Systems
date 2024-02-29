import {
  ClientContext,
  Container,
  ItemResponse,
  Items,
  PartitionKey,
  QueryIterator,
  SqlQuerySpec,
} from '@azure/cosmos';

export interface CamsItem {
  id?: string;
}

export interface QueryParameter {
  name: string;
  value: string | number | boolean;
}

export interface QueryOptions {
  query: string;
  parameters: Array<QueryParameter>;
}

export class CosmosItemHumble {
  private partitionKey: PartitionKey;
  private container: Container;
  private id: string;
  private clientContext: ClientContext;
  constructor(
    container: Container,
    id: string,
    partitionKey: PartitionKey,
    clientContext: ClientContext,
  ) {
    this.partitionKey = partitionKey;
    this.container = container;
    this.id = id;
    this.clientContext = clientContext;
  }

  async delete<T>(): Promise<ItemResponse<T>> {
    return this.container.item(this.id, this.partitionKey).delete<T>();
  }

  async read<T>(): Promise<ItemResponse<T>> {
    return this.container.item(this.id, this.partitionKey).read<T>();
  }

  async replace<T>(item: T): Promise<ItemResponse<T>> {
    return this.container.item(this.id, this.partitionKey).replace<T>(item);
  }
}

export class CosmosItemsHumble {
  private items: Items;
  private container: Container;
  private clientContext: ClientContext;
  constructor(container: Container, clientContext: ClientContext) {
    this.container = container;
    this.clientContext = clientContext;
    this.items = new Items(this.container, this.clientContext);
  }

  async create<T>(item: T): Promise<ItemResponse<T>> {
    return this.items.create<T>(item);
  }

  async upsert<T>(item: T): Promise<ItemResponse<T>> {
    return this.items.upsert<T>(item);
  }

  query<T>(query: string | QueryOptions): QueryIterator<T> {
    let converted;
    if (typeof query !== 'string') {
      converted = query as SqlQuerySpec;
    } else {
      converted = query;
    }
    return this.items.query<T>(converted);
  }
}
