import { httpPost } from '../utils/http';
import * as dotenv from 'dotenv';
import { AzurePacerTokenSecretGateway } from './azure-pacer-token-secret.gateway';
import { NoPacerToken } from './pacer-exceptions';

dotenv.config();

export class PacerLogin {
  azurePacerTokenSecretGateway: AzurePacerTokenSecretGateway;

  constructor() {
    this.azurePacerTokenSecretGateway = new AzurePacerTokenSecretGateway();
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
      token = await this.azurePacerTokenSecretGateway.getPacerTokenFromSecrets();
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
    try {
      const response = await httpPost({
        url: process.env.PACER_TOKEN_URL,
        body: {
          loginId: process.env.PACER_TOKEN_LOGIN_ID,
          password: process.env.PACER_TOKEN_PASSWORD,
        },
      });

      if (response.status == 200) {
        token = this.getValidToken(response.data);
        await this.azurePacerTokenSecretGateway.savePacerTokenToSecrets(token);
      } else {
        throw Error('Failed to Connect to PACER API');
      }
    } catch (e) {
      throw e;
    }

    return token;
  }
}
