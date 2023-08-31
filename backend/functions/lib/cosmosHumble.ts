import { CosmosClient } from '@azure/cosmos';
import { ApplicationConfiguration } from './configs/application-configuration';
import { DefaultAzureCredential, ManagedIdentityCredential } from '@azure/identity';

export default class CosmosHumble {
  private cosmosClient: CosmosClient;

  constructor(config: ApplicationConfiguration) {
    this.cosmosClient = new CosmosClient({
      endpoint: config.get('cosmosConfig').endpoint,
      aadCredentials: config.get('cosmosConfig').managedIdentity
        ? new ManagedIdentityCredential({
            clientId: config.get('cosmosConfig').managedIdentity,
          })
        : new DefaultAzureCredential(),
    });
  }
}
