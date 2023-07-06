import { httpPost } from '../utils/http';
import * as dotenv from 'dotenv';
import { NoPacerToken } from './pacer-exceptions';
import { PacerSecretsInterface } from './pacer-secrets.interface';
import { Context } from '../types/basic';

dotenv.config();

export class PacerLogin {
  pacerSecretGateway: PacerSecretsInterface;

  constructor(pacerSecretGateway: PacerSecretsInterface) {
    this.pacerSecretGateway = pacerSecretGateway;
  }

  private getValidToken(data: any): string {
    if (data.loginResult == 0) {
      return data.nextGenCSO;
    } else if (data.loginResult == 1) {
      throw Error(data.errorDescription);
    } else {
      throw Error('Error retrieving token');
    }
  }

  public async getPacerToken(context: Context): Promise<string> {
    let token: string;
    try {
      token = await this.pacerSecretGateway.getPacerTokenFromSecrets(context);
    } catch (e) {
      if (e instanceof NoPacerToken) {
        token = await this.getAndStorePacerToken(context);
      } else {
        throw e;
      }
    }
    return token;
  }

  public async getAndStorePacerToken(context: Context): Promise<string> {
    let token: string;
    const pacerUserId = await this.pacerSecretGateway.getPacerUserIdFromSecrets(context);
    const pacerPassword = await this.pacerSecretGateway.getPacerPasswordFromSecrets(context);
    try {
      const response = await httpPost({
        url: process.env.PACER_TOKEN_URL,
        body: {
          loginId: pacerUserId,
          password: pacerPassword,
        },
      });

      if (response.status == 200) {
        token = this.getValidToken(response.data);
        await this.pacerSecretGateway.savePacerTokenToSecrets(token, context);
      } else {
        throw Error('Failed to Connect to PACER API');
      }
    } catch (e) {
      throw e;
    }

    return token;
  }
}
