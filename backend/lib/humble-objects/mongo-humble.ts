import { Collection, Db, MongoClient } from 'mongodb';
import { Closable } from '../deferrable/defer-close';
import { ApplicationContext } from '../adapters/types/basic';

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

  public async deleteOne(query: DocumentQuery) {
    return this.collection.deleteOne(query);
  }

  public async deleteMany(query: DocumentQuery) {
    return this.collection.deleteMany(query);
  }

  public async countDocuments(query: DocumentQuery) {
    return this.collection.countDocuments(query);
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

  constructor(connectionString: string, context: ApplicationContext) {
    this.client = new MongoClient(connectionString);
    this.client.on('commandStarted', (event) =>
      context.logger.debug('MONGO_CLIENT', 'Mongo commandStarted:', event),
    );
    this.client.on('commandSucceeded', (event) =>
      context.logger.debug('MONGO_CLIENT', 'Mongo commandSucceeded', event),
    );
    this.client.on('commandFailed', (event) =>
      context.logger.debug('MONGO_CLIENT', 'Mongo commandFailed', event),
    );
  }

  public database(databaseName: string): DatabaseHumble {
    return new DatabaseHumble(this.client, databaseName);
  }

  public async close() {
    await this.client.close();
  }
}

export type Filter = {
  [key: string]: unknown;
  $where?: undefined;
  $lookup?: undefined;
};

//TODO: Why is this boolean operation required to have this function?
export type BooleanOperation = {
  and?: Filter[];
  or?: Filter[];
  $where?: undefined;
  $lookup?: undefined;
};

export type DocumentQuery = BooleanOperation & {
  [key: string]: Filter | Filter[] | BooleanOperation;
};
