import { httpPost } from '../utils/http';
import * as dotenv from 'dotenv';
import { NoPacerToken } from './pacer-exceptions';
import { PacerTokenSecretInterface } from './pacer-token-secret.interface';

dotenv.config();

export class PacerLogin {
  pacerTokenSecretInterface: PacerTokenSecretInterface;

  constructor(pacerTokenSecretInterface: PacerTokenSecretInterface) {
    this.pacerTokenSecretInterface = pacerTokenSecretInterface;
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
      token = await this.pacerTokenSecretInterface.getPacerTokenFromSecrets();
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
        this.pacerTokenSecretInterface.savePacerTokenToSecrets(token);
      } else {
        throw Error('Failed to Connect to PACER API');
      }
    } catch (e) {
      throw e;
    }

    return token;
  }
}
