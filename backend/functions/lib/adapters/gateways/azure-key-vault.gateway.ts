import { SecretsInterface } from './secrets.interface';
import { KeyVaultSecret, SecretClient } from '@azure/keyvault-secrets';
import { DefaultAzureCredential } from '@azure/identity';
import { Context } from '../types/basic';
import log from '../services/logger.service';

const NAMESPACE = 'AZURE-KEY-VAULT-GATEWAY';

export class AzureKeyVaultGateway implements SecretsInterface {
  secretClient: SecretClient;
  keyVaultUrl: string;

  constructor(secretClient?: SecretClient) {
    if (secretClient == undefined) {
      const credentials = new DefaultAzureCredential();
      this.keyVaultUrl = process.env.AZURE_KEY_VAULT_URL;
      this.secretClient = new SecretClient(this.keyVaultUrl, credentials)
    } else {
      this.secretClient = secretClient;
    }
  }

  public async getSecret(name: string, context: Context): Promise<string> {
    log.info(context, NAMESPACE, `Retrieving '${name}' secret from Key Vault: ${this.keyVaultUrl}.`);
    let keyVaultResponse: KeyVaultSecret;
    try {
      keyVaultResponse = await this.secretClient.getSecret(name);
    } catch (e) {
      const message = e.message;
      if (message.match(`${name} was not found in this key vault`)) {
        log.error(context, NAMESPACE, `The secret ${name} was not found.`);
        throw new Error(`The secret ${name} was not found.`);
      } else {
        log.error(context, NAMESPACE, `Error retrieving '${name}' secret: ${message}.`);
        throw new Error(message);
      }
    }
    return Promise.resolve(keyVaultResponse.value);
  }

  public async setSecret(name: string, value: string, context: Context): Promise<string> {
    log.info(context, NAMESPACE, `Saving '${name}' secret to Key Vault: ${this.keyVaultUrl}.`);
    return await this.secretClient.setSecret(name, value).then(response => {
      if (response.name != name) {
        throw new Error(`New KeyVault token '${name}' was not saved.`);
      }
      return response.name;
    });
  }
}
