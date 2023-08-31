import { ClientContext, Containers, CosmosClient, Database, Users } from '@azure/cosmos';
import CosmosContainerHumble from './cosmosContainerHumble';

export default class CosmosDatabaseHumble {
  private containers: Containers;
  private database: Database;
  private client: CosmosClient;
  private clientContext: ClientContext;
  private id: string;
  private users: Users;

  constructor(client: CosmosClient, id: string, context: ClientContext) {
    this.client = client;
    this.clientContext = context;
    this.id = id;
    this.database = new Database(this.client, this.id, this.clientContext);
    this.containers = new Containers(this.database, this.clientContext);
    this.users = new Users(this.database, this.clientContext);
  }

  public container(id: string): CosmosContainerHumble {
    console.log('We are in the humble object database ', id);
    return new CosmosContainerHumble(this.database, id, this.clientContext);
  }
}
