import { ClientContext, Containers, CosmosClient, Database } from '@azure/cosmos';
import CosmosContainerHumble from './cosmos-container-humble';

export default class CosmosDatabaseHumble {
  private containers: Containers;
  private database: Database;
  private client: CosmosClient;
  private clientContext: ClientContext;
  private id: string;

  constructor(client: CosmosClient, id: string, context: ClientContext) {
    this.client = client;
    this.clientContext = context;
    this.id = id;
    this.database = new Database(this.client, this.id, this.clientContext);
    this.containers = new Containers(this.database, this.clientContext);
  }

  public container(id: string): CosmosContainerHumble {
    return new CosmosContainerHumble(this.database, id, this.clientContext);
  }
}
