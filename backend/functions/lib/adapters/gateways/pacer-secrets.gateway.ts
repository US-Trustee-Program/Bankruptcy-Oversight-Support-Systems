import { PacerSecretsInterface } from './pacer-secrets.interface';
import * as dotenv from 'dotenv';
import { NoPacerToken } from './pacer-exceptions';
import { SecretsInterface } from './secrets.interface';
import { AzureKeyVaultGateway } from './azure-key-vault.gateway';
import { Context } from '../types/basic';

dotenv.config();

class PacerSecretsGateway implements PacerSecretsInterface {
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

  public async savePacerTokenToSecrets(context: Context, token: string) {
    await this.secretsGateway.setSecret(context, this.pacerTokenName, token);
  }

  public async getPacerTokenFromSecrets(context: Context): Promise<string> {
    let tokenResponse: string;
    try {
      tokenResponse = await this.secretsGateway.getSecret(context, this.pacerTokenName);
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
    return await this.secretsGateway.getSecret(context, process.env.PACER_USER_ID_SECRET_NAME);
  }

  public async getPacerPasswordFromSecrets(context: Context): Promise<string> {
    return await this.secretsGateway.getSecret(context, process.env.PACER_PASSWORD_SECRET_NAME);
  }
}

export { PacerSecretsGateway };
