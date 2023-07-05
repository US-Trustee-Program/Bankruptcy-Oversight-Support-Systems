import { SecretsInterface } from './secrets.interface';
import {KeyVaultSecret, SecretClient} from '@azure/keyvault-secrets';
import { DefaultAzureCredential } from '@azure/identity';

export class AzureKeyVaultGateway implements SecretsInterface {
  secretClient: SecretClient;

  constructor(secretClient?: SecretClient) {
    if (secretClient == undefined) {
      const credentials = new DefaultAzureCredential();
      this.secretClient = new SecretClient(process.env.AZURE_KEY_VAULT_URL, credentials)
    } else {
      this.secretClient = secretClient;
    }
  }

  public async getSecret(name: string): Promise<string> {
    let keyVaultResponse: KeyVaultSecret;
    try {
      keyVaultResponse = await this.secretClient.getSecret(name);
    } catch (e) {
      const message = e.message;
      if (message.match(`${name} was not found in this key vault`)) {
        throw new Error(`The secret ${name} was not found.`);
      } else {
        throw new Error(message);
      }
    }
    return Promise.resolve(keyVaultResponse.value);
  }

  public async setSecret(name: string, value: string): Promise<string> {
    return await this.secretClient.setSecret(name, value).then(response => {
      if (response.name != name) {
        throw new Error(`New KeyVault token ${name} was not saved.`);
      }
      return response.name;
    });
  }
}
