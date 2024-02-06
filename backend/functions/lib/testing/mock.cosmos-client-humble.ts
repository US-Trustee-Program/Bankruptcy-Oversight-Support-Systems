import * as crypto from 'crypto';

type QueryParameter = Record<string, string>;

interface QueryOptions {
  query: string;
  parameters: Array<QueryParameter>;
}

export class HumbleQuery<T> {
  items: HumbleItems<T>;
  query: QueryOptions;
  constructor(items: HumbleItems<T>, query: QueryOptions) {
    this.items = items;
    this.query = query;
  }
  async fetchAll(): Promise<{ resources: Array<T> }> {
    return { resources: [...this.items.container.map.values()] };
  }
}

export class HumbleItem<T> {
  container: HumbleContainer<T>;
  id: string;
  constructor(container: HumbleContainer<T>, id: string) {
    this.container = container;
    this.id = id;
  }
  async read(): Promise<{ resource: T }> {
    if (this.container.map.has(this.id)) {
      return {
        resource: this.container.map.get(this.id),
      };
    }
    // TODO: We should probably make this function work for real and throw a reasonable error.
    // throw Error('Not found');
  }
  async replace(item: T): Promise<{ id: string }> {
    if (this.container.map.has(this.id)) {
      this.container.map.set(this.id, item);
      return { id: this.id };
    }
    // TODO: We should probably make this function work for real and throw a reasonable error.
    // throw Error('Not found');
  }
}

export class HumbleItems<T> {
  container: HumbleContainer<T>;
  constructor(container: HumbleContainer<T>) {
    this.container = container;
  }
  async create(item: T) {
    const id = crypto.randomUUID().toString();
    const itemWithId = { ...item, id };
    this.container.map.set(id, itemWithId);
    return this.container.map.get(id);
  }
  async upsert(item: T) {
    const id = item['id'] || crypto.randomUUID().toString();
    const itemWithId = { ...item, id };
    this.container.map.set(id, itemWithId);
    return this.container.map.get(id);
  }
  query(query: QueryOptions) {
    return new HumbleQuery<T>(this, query);
  }
}

export class HumbleContainer<T> {
  database: HumbleDatabase<T>;
  containerName: string;
  map = new Map<string, T>();
  constructor(database: HumbleDatabase<T>, containerName: string) {
    this.database = database;
    this.containerName = containerName;
  }
  public get items() {
    return new HumbleItems<T>(this);
  }
  item(id: string, _partitionKey?: string) {
    return new HumbleItem(this, id);
  }
}

export class HumbleDatabase<T> {
  databaseId: string;
  constructor(databaseId: string) {
    this.databaseId = databaseId;
  }
  container(containerName: string) {
    return new HumbleContainer<T>(this, containerName);
  }
}

export class HumbleClient<T> {
  database(databaseId: string) {
    return new HumbleDatabase<T>(databaseId);
  }
}
