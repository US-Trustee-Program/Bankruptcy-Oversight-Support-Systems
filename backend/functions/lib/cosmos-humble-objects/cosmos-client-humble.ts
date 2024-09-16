import {
  ClientContext,
  CosmosClient,
  CosmosClientOptions,
  CosmosDiagnostics,
  DatabaseAccount,
  Databases,
  DiagnosticNodeInternal,
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

    this.clientContext = this.cosmosClient['clientContext'];

    this.databases = this.cosmosClient['databases'];
  }

  public database(id: string): CosmosDatabaseHumble {
    return new CosmosDatabaseHumble(this.cosmosClient, id, this.clientContext);
  }

  private async getDatabaseAccount(
    options?: RequestOptions,
  ): Promise<ResourceResponse<DatabaseAccount>> {
    const response = await this.clientContext.getDatabaseAccount(
      new DiagnosticNodeInternal(),
      options,
    );
    return new ResourceResponse<DatabaseAccount>(
      response.result,
      response.headers,
      response.code,
      new CosmosDiagnostics(),
      response.substatus,
    );
  }
}
