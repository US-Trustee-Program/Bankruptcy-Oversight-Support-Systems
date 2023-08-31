import { ClientContext, Container, Database, Item, Items, PartitionKey } from '@azure/cosmos';

export default class CosmosContainerHumble {
  private itemsCollection: Items;
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
  public get items(): Items {
    if (!this.itemsCollection) {
      this.itemsCollection = new Items(this.container, this.clientContext);
    }
    return this.itemsCollection;
  }

  public item(id: string, partitionKeyValue?: string | number | unknown): Item {
    return new Item(this.container, id, partitionKeyValue as PartitionKey, this.clientContext);
  }
}
