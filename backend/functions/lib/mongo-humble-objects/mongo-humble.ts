// https://cosmos-ustp-cams-mongo.mongo.cosmos.azure.us:443/
import { MongoClient } from 'mongodb';

export class DocumentClient {
  private client: MongoClient;

  constructor(url: string) {
    this.client = new MongoClient(url);
  }
}
