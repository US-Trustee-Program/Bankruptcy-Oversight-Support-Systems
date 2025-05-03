import { Collection, Db, MongoClient, Document as MongoDocument } from 'mongodb';

import { Closable } from '../deferrable/defer-close';

export type AggregateQuery = MongoDocument;

export type DocumentQuery = {
  $lookup?: undefined;
  $where?: undefined;
  [key: string]: Filter | Filter[];
  and?: Filter[];
  or?: Filter[];
};

export type Filter = {
  [key: string]: unknown;
};

export class CollectionHumble<T> {
  private collection: Collection<T>;

  constructor(database: Db, collectionName: string) {
    this.collection = database.collection<T>(collectionName);
  }

  public async aggregate(query: AggregateQuery) {
    const queryArray = Array.isArray(query) ? query : [query];
    return this.collection.aggregate(queryArray);
  }

  public async countDocuments(query: DocumentQuery) {
    return this.collection.countDocuments(query);
  }

  public async deleteMany(query: DocumentQuery) {
    return this.collection.deleteMany(query);
  }

  public async deleteOne(query: DocumentQuery) {
    return this.collection.deleteOne(query);
  }

  public async find(query: DocumentQuery) {
    return this.collection.find(query);
  }

  public async findOne<T>(query: DocumentQuery): Promise<null | T> {
    return this.collection.findOne<T>(query);
  }

  public async insertMany(items) {
    return this.collection.insertMany(items);
  }

  public async insertOne(item) {
    return this.collection.insertOne(item);
  }

  public async replaceOne(query: DocumentQuery, item, upsert: boolean = false) {
    return this.collection.replaceOne(query, item, { upsert });
  }

  public async updateOne(query: DocumentQuery, item) {
    return this.collection.updateOne(query, { $set: item });
  }
}

export class DatabaseHumble {
  private readonly database: Db;

  constructor(client: MongoClient, name: string) {
    this.database = new Db(client, name);
  }

  public collection<T>(collectionName: string): CollectionHumble<T> {
    return new CollectionHumble<T>(this.database, collectionName);
  }
}

export class DocumentClient implements Closable {
  protected client: MongoClient;

  constructor(connectionString: string) {
    this.client = new MongoClient(connectionString);
  }

  public async close() {
    await this.client.close();
  }

  public database(databaseName: string): DatabaseHumble {
    return new DatabaseHumble(this.client, databaseName);
  }
}

export function isMongoDocumentArray(arr: unknown): arr is MongoDocument[] {
  return (
    Array.isArray(arr) && arr.every((item) => item && typeof item === 'object' && '_id' in item)
  );
}
