import * as crypto from 'crypto';
import { QueryOptions } from '../cosmos-humble-objects/cosmos-items-humble';

export class HumbleQuery<T> {
  items: HumbleItems;
  query: QueryOptions;
  constructor(items: HumbleItems, query: QueryOptions) {
    this.items = items;
    this.query = query;
  }
  async fetchAll(): Promise<{ resources: Array<T> }> {
    return { resources: [...this.items.container.map.values()] };
  }
}

export class HumbleItem {
  container: HumbleContainer;
  id: string;
  constructor(container: HumbleContainer, id: string) {
    this.container = container;
    this.id = id;
  }
  async read<T>(): Promise<{ resource: T }> {
    if (this.container.map.has(this.id)) {
      return {
        resource: this.container.map.get(this.id),
      };
    }
    // TODO: We should probably make this function work for real and throw a reasonable error.
    // throw Error('Not found');
  }
  async replace<T>(item: T): Promise<{ item: T }> {
    if (this.container.map.has(this.id)) {
      this.container.map.set(this.id, item);
      return { item };
    }
    // TODO: We should probably make this function work for real and throw a reasonable error.
    // throw Error('Not found');
  }
  async delete<T>(item: T): Promise<{ item: T }> {
    if (this.container.map.has(this.id)) {
      this.container.map.delete(this.id);
      return { item };
    }
    // TODO: We should probably make this function work for real and throw a reasonable error.
    // throw Error('Not found');
  }
}

export class HumbleItems {
  container: HumbleContainer;
  constructor(container: HumbleContainer) {
    this.container = container;
  }
  async create<T>(item: T) {
    const id = crypto.randomUUID().toString();
    const itemWithId = { ...item, id };
    this.container.map.set(id, itemWithId);
    return { item: this.container.map.get(id) };
  }
  async upsert<T>(item: T) {
    const id = item['id'] || crypto.randomUUID().toString();
    const itemWithId = { ...item, id };
    this.container.map.set(id, itemWithId);
    return this.container.map.get(id);
  }
  query<T>(query: QueryOptions): HumbleQuery<T> {
    return new HumbleQuery<T>(this, query);
  }
}

export class HumbleContainer {
  database: HumbleDatabase;
  containerName: string;
  map = new Map();
  constructor(database: HumbleDatabase, containerName: string) {
    this.database = database;
    this.containerName = containerName;
  }
  public get items() {
    return new HumbleItems(this);
  }
  item(id: string, _partitionKey?: string) {
    return new HumbleItem(this, id);
  }
}

export class HumbleDatabase {
  databaseId: string;
  constructor(databaseId: string) {
    this.databaseId = databaseId;
  }
  container(containerName: string) {
    return new HumbleContainer(this, containerName);
  }
}

export class HumbleClient {
  database(databaseId: string) {
    return new HumbleDatabase(databaseId);
  }
}
