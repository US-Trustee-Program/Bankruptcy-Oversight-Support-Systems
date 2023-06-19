import { PacerTokenSecretInterface } from './pacer-token-secret.interface';
import { KeyVaultSecret, SecretClient } from '@azure/keyvault-secrets';
import * as dotenv from 'dotenv';
import { DefaultAzureCredential, TokenCredential } from '@azure/identity';
import { NoPacerToken } from './pacer-exceptions';

dotenv.config();

class AzurePacerTokenSecretGateway implements PacerTokenSecretInterface {
  secretClient: SecretClient;
  pacerTokenName: string;

  constructor() {
    const credentials = new DefaultAzureCredential();
    this.secretClient = new SecretClient(process.env.AZURE_KEY_VAULT_URL, credentials);
    this.pacerTokenName = 'pacer-token-test';
  }

  async savePacerTokenToSecrets(token: string) {
    try {
      const tokenResponse = await this.secretClient.setSecret(this.pacerTokenName, token);
      if (tokenResponse.name != this.pacerTokenName) {
        throw new Error('New KeyVault token not saved');
      }
    } catch (e) {
      throw e;
    }
  }

  async getPacerTokenFromSecrets(): Promise<string> {
    let tokenResponse: KeyVaultSecret;
    try {
      tokenResponse = await this.secretClient.getSecret(this.pacerTokenName);
    } catch (e) {
      const message = e.message;
      if (message.match(`${this.pacerTokenName} was not found in this key vault`)) {
        throw new NoPacerToken();
      } else {
        throw(e);
      }
    }
    return Promise.resolve(tokenResponse.value);
  }
}

export { AzurePacerTokenSecretGateway };
