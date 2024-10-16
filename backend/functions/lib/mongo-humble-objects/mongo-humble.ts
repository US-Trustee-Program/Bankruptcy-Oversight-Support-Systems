// https://cosmos-ustp-cams-mongo.mongo.cosmos.azure.us:443/
import { Collection, Db, MongoClient } from 'mongodb';
import { DocumentQuery, transformQuery } from '../adapters/gateways/document-db.repository';

export class CollectionHumble<T> {
  private collection: Collection<T>;

  constructor(database: Db, collectionName: string) {
    this.collection = database.collection<T>(collectionName);
  }

  public async find(query: DocumentQuery) {
    const transformed = transformQuery(query);
    console.log(transformed);
    return this.collection.find(transformed);
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
