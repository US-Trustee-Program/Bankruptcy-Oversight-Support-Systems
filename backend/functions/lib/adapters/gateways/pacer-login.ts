import { httpPost } from '../utils/http';
import * as dotenv from 'dotenv';
import { NoPacerToken } from './pacer-exceptions';
import { PacerSecretsInterface } from './pacer-secrets.interface';

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

  public async getPacerToken(): Promise<string> {
    let token: string;
    try {
      token = await this.pacerSecretGateway.getPacerTokenFromSecrets();
    } catch (e) {
      if (e instanceof NoPacerToken) {
        token = await this.getAndStorePacerToken();
      } else {
        throw e;
      }
    }
    return token;
  }

  public async getAndStorePacerToken(): Promise<string> {
    let token: string;
    const pacerUserId = await this.pacerSecretGateway.getPacerUserIdFromSecrets();
    const pacerPassword = await this.pacerSecretGateway.getPacerPasswordFromSecrets();
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
        this.pacerSecretGateway.savePacerTokenToSecrets(token);
      } else {
        throw Error('Failed to Connect to PACER API');
      }
    } catch (e) {
      throw e;
    }

    return token;
  }
}
