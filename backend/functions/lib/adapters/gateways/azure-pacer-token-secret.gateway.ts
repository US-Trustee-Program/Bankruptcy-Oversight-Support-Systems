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
    this.pacerTokenName = 'pacer-token';
  }

  async savePacerTokenToSecrets(token: string) {
    const tokenResponse = this.secretClient.setSecret(this.pacerTokenName, token);
    console.log(tokenResponse);
  }

  async getPacerTokenFromSecrets(): Promise<string> {
    let tokenResponse: KeyVaultSecret;
    try {
      tokenResponse = await this.secretClient.getSecret(this.pacerTokenName);
    } catch (e) {
      const message = e.message;
      if (message.match('pacer-token was not found in this key vault')) {
        throw new NoPacerToken();
      }
    }
    return Promise.resolve(tokenResponse.value);
  }
}

export { AzurePacerTokenSecretGateway };
