import {
  ClientContext,
  CosmosClient,
  CosmosClientOptions,
  DatabaseAccount,
  Databases,
  GlobalEndpointManager,
  Offer,
  Offers,
  RequestOptions,
  ResourceResponse,
} from '@azure/cosmos';
import { ApplicationConfiguration } from '../configs/application-configuration';
import { DefaultAzureCredential, ManagedIdentityCredential } from '@azure/identity';
import CosmosDatabaseHumble from './cosmosDatabaseHumble';

export default class CosmosHumble {
  private cosmosClient: CosmosClient;
  private clientContext: ClientContext;
  private databases: Databases;
  private options: CosmosClientOptions;
  private offers: Offers;
  private endpointRefresher: NodeJS.Timeout;

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
    this.offers = new Offers(this.cosmosClient, this.clientContext);
  }

  public database(id: string): CosmosDatabaseHumble {
    return new CosmosDatabaseHumble(this.cosmosClient, id, this.clientContext);
  }

  public async getDatabaseAccount(
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public offer(id: string): Offer {
    throw new Error('not implemented');
  }

  public getWriteEndpoint(): Promise<string> {
    return this.clientContext.getWriteEndpoint();
  }

  public getReadEndpoint(): Promise<string> {
    return this.clientContext.getReadEndpoint();
  }

  public getWriteEndpoints(): Promise<readonly string[]> {
    return this.clientContext.getWriteEndpoints();
  }

  public getReadEndpoints(): Promise<readonly string[]> {
    return this.clientContext.getReadEndpoints();
  }

  public dispose(): void {
    clearTimeout(this.endpointRefresher);
  }

  private async backgroundRefreshEndpointList(
    globalEndpointManager: GlobalEndpointManager,
    refreshRate: number,
  ) {
    this.endpointRefresher = setInterval(() => {
      try {
        globalEndpointManager.refreshEndpointList();
      } catch (e: unknown) {
        console.warn('Failed to refresh endpoints', e);
      }
    }, refreshRate);
    if (this.endpointRefresher.unref && typeof this.endpointRefresher.unref === 'function') {
      this.endpointRefresher.unref();
    }
  }
}
