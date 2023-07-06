import { PacerSecretsInterface } from './pacer-secrets.interface';
import * as dotenv from 'dotenv';
import { NoPacerToken } from './pacer-exceptions';
import { SecretsInterface } from './secrets.interface';
import { AzureKeyVaultGateway } from './azure-key-vault.gateway';
import { Context } from '../types/basic';

dotenv.config();

class AzurePacerSecretsGateway implements PacerSecretsInterface {
  pacerTokenName: string;
  secretsGateway: SecretsInterface;

  constructor(secretsGateway?: SecretsInterface) {
    this.pacerTokenName = process.env.PACER_TOKEN_SECRET_NAME;
    if (secretsGateway != undefined) {
      this.secretsGateway = secretsGateway;
    } else {
      this.secretsGateway = new AzureKeyVaultGateway();
    }
  }

  public async savePacerTokenToSecrets(token: string, context: Context) {
    await this.secretsGateway.setSecret(this.pacerTokenName, token, context);
  }

  public async getPacerTokenFromSecrets(context: Context): Promise<string> {
    let tokenResponse: string;
    try {
      tokenResponse = await this.secretsGateway.getSecret(this.pacerTokenName, context);
    } catch (e) {
      const message = e.message;
      if (message === `The secret ${this.pacerTokenName} was not found.`) {
        throw new NoPacerToken();
      } else {
        throw e;
      }
    }
    return Promise.resolve(tokenResponse);
  }

  public async getPacerUserIdFromSecrets(context: Context): Promise<string> {
    return await this.secretsGateway.getSecret('qa-pacer-user-id', context);
  }

  public async getPacerPasswordFromSecrets(context: Context): Promise<string> {
    return await this.secretsGateway.getSecret('qa-pacer-password', context);
  }
}

export { AzurePacerSecretsGateway };
