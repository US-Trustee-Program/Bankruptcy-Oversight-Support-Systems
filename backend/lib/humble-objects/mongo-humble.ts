import { Collection, Db, MongoClient, Document as MongoDocument } from 'mongodb';
import { Closable } from '../deferrable/defer-close';

export class CollectionHumble<T> {
  private collection: Collection<T>;

  constructor(database: Db, collectionName: string) {
    this.collection = database.collection<T>(collectionName);
  }

  public async find(query: DocumentQuery) {
    return this.collection.find(query);
  }

  public async findOne<T>(query: DocumentQuery): Promise<T | null> {
    return this.collection.findOne<T>(query);
  }

  public async insertOne(item) {
    return this.collection.insertOne(item);
  }

  public async insertMany(items) {
    return this.collection.insertMany(items);
  }

  public async replaceOne(query: DocumentQuery, item, upsert: boolean = false) {
    return this.collection.replaceOne(query, item, { upsert });
  }

  public async updateOne(query: DocumentQuery, item) {
    return this.collection.updateOne(query, { $set: item });
  }

  public async updateMany(query: DocumentQuery, update: MongoDocument) {
    return this.collection.updateMany(query, update);
  }

  public async deleteOne(query: DocumentQuery) {
    return this.collection.deleteOne(query);
  }

  public async deleteMany(query: DocumentQuery) {
    return this.collection.deleteMany(query);
  }

  public async countDocuments(query: DocumentQuery) {
    return this.collection.countDocuments(query);
  }

  public async aggregate(query: AggregateQuery) {
    const queryArray = Array.isArray(query) ? query : [query];
    return this.collection.aggregate(queryArray);
  }

  public async bulkWrite(operations) {
    return this.collection.bulkWrite(operations);
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

  public async listCollections() {
    return this.database.listCollections().toArray();
  }
}

export class DocumentClient implements Closable {
  protected client: MongoClient;

  constructor(connectionString: string) {
    this.client = new MongoClient(connectionString);
  }

  public database(databaseName: string): DatabaseHumble {
    return new DatabaseHumble(this.client, databaseName);
  }

  public async close() {
    await this.client.close();
  }
}

type Filter = {
  [key: string]: unknown;
};

export type DocumentQuery = {
  [key: string]: Filter | Filter[];
  and?: Filter[];
  or?: Filter[];
  $where?: undefined;
  $lookup?: undefined;
};

export type AggregateQuery = MongoDocument;
