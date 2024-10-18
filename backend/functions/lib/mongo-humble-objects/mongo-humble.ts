// https://cosmos-ustp-cams-mongo.mongo.cosmos.azure.us:443/
import { Collection, Db, MongoClient } from 'mongodb';
import { DocumentQuery, transformQuery } from '../adapters/gateways/document-db.repository';

export class CollectionHumble<T> {
  //TODO: Mongo adds an _id index by default, it is suggested we use this instead of id. we need to switch
  private collection: Collection<T>;

  constructor(database: Db, collectionName: string) {
    this.collection = database.collection<T>(collectionName);
  }

  public async find(query: DocumentQuery) {
    return this.collection.find(transformQuery(query));
  }

  public async findOne(query: DocumentQuery) {
    return this.collection.findOne(transformQuery(query));
  }

  public async insertOne(item) {
    return this.collection.insertOne(item);
  }

  public async replaceOne(query: DocumentQuery, item) {
    return this.collection.replaceOne(transformQuery(query), item);
  }

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

export class DocumentClient {
  protected client: MongoClient;

  constructor(connectionString: string) {
    this.client = new MongoClient(connectionString);
  }

  public database(databaseName: string): DatabaseHumble {
    return new DatabaseHumble(this.client, databaseName);
  }
  public close() {
    return this.client.close();
  }
}
