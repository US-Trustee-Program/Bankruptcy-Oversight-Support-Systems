import { PacerTokenSecretInterface } from './pacer-token-secret.interface';
import { SecretClient } from '@azure/keyvault-secrets';
import * as dotenv from 'dotenv';
import { DefaultAzureCredential, TokenCredential } from '@azure/identity';
import { NoPacerToken } from './pacer-exceptions';

dotenv.config();

class AzurePacerTokenSecretGateway implements PacerTokenSecretInterface {
  async getPacerTokenFromSecrets(): Promise<string> {
    const credentials: TokenCredential = new DefaultAzureCredential();
    const secretClient = new SecretClient(process.env.AZURE_KEY_VAULT_URL, credentials);
    let token;
    try {
      token = await secretClient.getSecret('pacer-token');
    } catch (e) {
      const message = e.message;
      if (message.match('pacer-token was not found in this key vault')) {
        throw new NoPacerToken();
      }
      console.log(e);
    }
    console.log(token);
    return Promise.resolve(token.value);
  }

}

export { AzurePacerTokenSecretGateway };
