import { httpPost } from '../utils/http';
import * as dotenv from 'dotenv';
import { AzurePacerTokenSecretGateway } from './azure-pacer-token-secret.gateway';
import { NoPacerToken } from './pacer-exceptions';

dotenv.config();

export class PacerLogin {
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
    const azurePacerTokenSecretGateway = new AzurePacerTokenSecretGateway();
    // - should we also check if the existing token is still valid?
    // Get existing token OR login if no existing token
    let token;
    try {
      token = await azurePacerTokenSecretGateway.getPacerTokenFromSecrets();
    } catch(e) {
      if (e instanceof NoPacerToken) {
        const response = await httpPost({
          url: process.env.PACER_TOKEN_URL,
          body: {
            loginId: process.env.PACER_TOKEN_LOGIN_ID,
            password: process.env.PACER_TOKEN_PASSWORD,
          },
        });

        if (response.status == 200) {
          if (response.data.loginResult == 0) {
            return response.data.nextGenCSO;
          } else if (response.data.loginResult == 1) {
            throw Error(response.data.errorDescription);
          } else {
            throw Error('Error retrieving token');
          }
        } else {
          throw Error('Failed to Connect to PACER API');
        }
      }

      // store token
    }
    // validate token
    // - if valid, return it
    // - if no token or invalid, get a new one
    //   - store the new one

    try {
      const response = await httpPost({
        url: process.env.PACER_TOKEN_URL,
        body: {
          loginId: process.env.PACER_TOKEN_LOGIN_ID,
          password: process.env.PACER_TOKEN_PASSWORD,
        },
      });

      if (response.status == 200) {
        return this.getValidToken(response.data);
      } else {
        throw Error('Failed to Connect to PACER API');
      }
    } catch (e) {
      throw e;
    }
  }
}
