import { ClientContext, Container, Database, PartitionKey } from '@azure/cosmos';
import { CosmosItemHumble, CosmosItemsHumble } from './cosmos-items-humble';
export default class CosmosContainerHumble {
  private itemsCollection: CosmosItemsHumble;
  private container: Container;
  private database: Database;
  private id: string;
  private clientContext: ClientContext;

  constructor(database: Database, id: string, clientContext: ClientContext) {
    this.database = database;
    this.id = id;
    this.clientContext = clientContext;
    this.container = new Container(this.database, this.id, this.clientContext);
  }

  public get items(): CosmosItemsHumble {
    if (!this.itemsCollection) {
      this.itemsCollection = new CosmosItemsHumble(this.container, this.clientContext);
    }
    return this.itemsCollection;
  }

  public item(id: string, partitionKeyValue?: string | number | unknown): CosmosItemHumble {
    return new CosmosItemHumble(
      this.container,
      id,
      partitionKeyValue as PartitionKey,
      this.clientContext,
    );
  }
}
