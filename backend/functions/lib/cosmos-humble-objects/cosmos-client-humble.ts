import {
  ClientContext,
  CosmosClient,
  CosmosClientOptions,
  DatabaseAccount,
  Databases,
  GlobalEndpointManager,
  RequestOptions,
  ResourceResponse,
} from '@azure/cosmos';
import { ApplicationConfiguration } from '../configs/application-configuration';
import { DefaultAzureCredential, ManagedIdentityCredential } from '@azure/identity';
import CosmosDatabaseHumble from './cosmos-database-humble';

export default class CosmosClientHumble {
  private readonly cosmosClient: CosmosClient;
  private readonly clientContext: ClientContext;
  private databases: Databases;
  private readonly options: CosmosClientOptions;

  constructor(config: ApplicationConfiguration) {
    this.options = {
      endpoint: config.get('cosmosConfig').endpoint,
      aadCredentials: config.get('cosmosConfig').managedIdentity
        ? new ManagedIdentityCredential({
            clientId: config.get('cosmosConfig').managedIdentity,
          })
        : new DefaultAzureCredential(),
    };
    this.cosmosClient = new CosmosClient(this.options);
    const globalEndpointManager = new GlobalEndpointManager(
      this.options,
      async (opts: RequestOptions) => this.getDatabaseAccount(opts),
    );
    this.clientContext = new ClientContext(this.options, globalEndpointManager);

    this.databases = new Databases(this.cosmosClient, this.clientContext);
  }

  public database(id: string): CosmosDatabaseHumble {
    return new CosmosDatabaseHumble(this.cosmosClient, id, this.clientContext);
  }

  private async getDatabaseAccount(
    options?: RequestOptions,
  ): Promise<ResourceResponse<DatabaseAccount>> {
    const response = await this.clientContext.getDatabaseAccount(options);
    return new ResourceResponse<DatabaseAccount>(
      response.result,
      response.headers,
      response.code,
      response.substatus,
    );
  }
}
