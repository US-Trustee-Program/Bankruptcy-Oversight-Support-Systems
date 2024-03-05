import * as crypto from 'crypto';
import { QueryOptions } from '../cosmos-humble-objects/cosmos-items-humble';

export class MockHumbleQuery<T> {
  items: MockHumbleItems;
  query: QueryOptions;
  constructor(items: MockHumbleItems, query: QueryOptions) {
    this.items = items;
    this.query = query;
  }
  async fetchAll(): Promise<{ resources: Array<T> }> {
    return { resources: [...this.items.container.map.values()] };
  }
}

export class MockHumbleItem {
  container: MockHumbleContainer;
  id: string;
  constructor(container: MockHumbleContainer, id: string) {
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
  async replace<T>(resource: T): Promise<{ resource: T }> {
    if (this.container.map.has(this.id)) {
      this.container.map.set(this.id, resource);
      return { resource };
    }
    // TODO: We should probably make this function work for real and throw a reasonable error.
    // throw Error('Not found');
  }
  async delete<T>(resource: T): Promise<{ resource: T }> {
    if (this.container.map.has(this.id)) {
      this.container.map.delete(this.id);
      return { resource };
    }
    // TODO: We should probably make this function work for real and throw a reasonable error.
    // throw Error('Not found');
  }
}

export class MockHumbleItems {
  container: MockHumbleContainer;
  constructor(container: MockHumbleContainer) {
    this.container = container;
  }
  async create<T>(resource: T) {
    const id = crypto.randomUUID().toString();
    const itemWithId = { ...resource, id };
    this.container.map.set(id, itemWithId);
    return { resource: this.container.map.get(id) };
  }
  async upsert<T>(resource: T) {
    const id = resource['id'] || crypto.randomUUID().toString();
    const itemWithId = { ...resource, id };
    this.container.map.set(id, itemWithId);
    return this.container.map.get(id);
  }
  query<T>(query: QueryOptions): MockHumbleQuery<T> {
    return new MockHumbleQuery<T>(this, query);
  }
}

export class MockHumbleContainer {
  database: MockHumbleDatabase;
  containerName: string;
  map = new Map();
  constructor(database: MockHumbleDatabase, containerName: string) {
    this.database = database;
    this.containerName = containerName;
  }
  public get items() {
    return new MockHumbleItems(this);
  }
  item(id: string, _partitionKey?: string) {
    return new MockHumbleItem(this, id);
  }
}

export class MockHumbleDatabase {
  databaseId: string;
  constructor(databaseId: string) {
    this.databaseId = databaseId;
  }
  container(containerName: string) {
    return new MockHumbleContainer(this, containerName);
  }
}

export class MockHumbleClient {
  database(databaseId: string) {
    return new MockHumbleDatabase(databaseId);
  }
}
