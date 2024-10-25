// https://cosmos-ustp-cams-mongo.mongo.cosmos.azure.us:443/
import { Collection, Db, MongoClient } from 'mongodb';
import { DocumentQuery, transformQuery } from '../adapters/gateways/document-db.repository';
import { Closable } from '../defer-close';

export class CollectionHumble<T> {
  //TODO: Mongo adds an _id index by default, it is suggested we use this instead of id. we need to switch
  private collection: Collection<T>;

  constructor(database: Db, collectionName: string) {
    this.collection = database.collection<T>(collectionName);
  }

  // TODO: Confirm and explicitly type the return
  public async find(query: DocumentQuery) {
    return this.collection.find(transformQuery(query));
  }

  public async findOne<T>(query: DocumentQuery): Promise<T | null> {
    return this.collection.findOne<T>(transformQuery(query));
  }

  // TODO: Confirm and explicitly type the return
  public async insertOne(item) {
    return this.collection.insertOne(item);
  }

  // TODO: Confirm and explicitly type the return
  public async insertMany(items) {
    return this.collection.insertMany(items);
  }

  // TODO: Confirm and explicitly type the return
  public async replaceOne(query: DocumentQuery, item, upsert: boolean = false) {
    return this.collection.replaceOne(transformQuery(query), item, { upsert });
  }

  // TODO: Confirm and explicitly type the return
  public async deleteOne(query: DocumentQuery) {
    return this.collection.deleteOne(transformQuery(query));
  }

  // TODO: Confirm and explicitly type the return
  public async deleteMany(query: DocumentQuery) {
    return this.collection.deleteMany(transformQuery(query));
  }

  // TODO: Confirm and explicitly type the return
  public async countDocuments(query: DocumentQuery) {
    return this.collection.countDocuments(transformQuery(query));
  }
}

export class DatabaseHumble {
  private database: Db;

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

  public database(databaseName: string): DatabaseHumble {
    return new DatabaseHumble(this.client, databaseName);
  }

  public async close() {
    await this.client.close();
  }
}