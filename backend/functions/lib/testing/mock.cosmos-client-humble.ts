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
  fetchAll(): { resources: Array<T> } {
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
  read() {
    if (this.container.map.has(this.id)) {
      return {
        resource: this.container.map.get(this.id),
      };
    }
  }
  replace(item: T) {
    if (this.container.map.has(this.id)) {
      this.container.map.set(this.id, item);
    }
  }
}

export class HumbleItems<T> {
  container: HumbleContainer<T>;
  constructor(container: HumbleContainer<T>) {
    this.container = container;
  }
  create(item: T) {
    this.container.map.set(crypto.randomUUID().toString(), item);
  }
  query(query: QueryOptions) {
    return new HumbleQuery(this, query);
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
