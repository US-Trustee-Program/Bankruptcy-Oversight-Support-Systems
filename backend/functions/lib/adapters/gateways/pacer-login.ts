import { httpPost } from '../utils/http';
import * as dotenv from 'dotenv';
import { NoPacerToken } from './pacer-exceptions';
import { PacerSecretsInterface } from './pacer-secrets.interface';
import { ApplicationContext } from '../types/basic';
import log from '../services/logger.service';

dotenv.config();

const NAMESPACE = 'PACER_LOGIN';

type PacerTokenResponse = {
  loginResult: number;
  nextGenCSO?: string;
  errorDescription?: string;
};

export class PacerLogin {
  pacerSecretGateway: PacerSecretsInterface;

  constructor(pacerSecretGateway: PacerSecretsInterface) {
    this.pacerSecretGateway = pacerSecretGateway;
  }

  private getValidToken(data: PacerTokenResponse): string {
    if (data.loginResult == 0) {
      return data.nextGenCSO;
    } else if (data.loginResult == 1) {
      throw Error(data.errorDescription);
    } else {
      throw Error('Error retrieving token');
    }
  }

  public async getPacerToken(context: ApplicationContext): Promise<string> {
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

  public async getAndStorePacerToken(context: ApplicationContext): Promise<string> {
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
        token = this.getValidToken(response.data as PacerTokenResponse);
        await this.pacerSecretGateway.savePacerTokenToSecrets(context, token);
      } else {
        throw Error('Failed to Connect to PACER API');
      }
    } catch (e) {
      log.error(context, NAMESPACE, e.message, e);
      throw e;
    }

    return token;
  }
}
