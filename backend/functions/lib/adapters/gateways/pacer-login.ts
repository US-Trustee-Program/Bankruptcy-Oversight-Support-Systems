import { httpPost } from '../utils/http';
import * as dotenv from 'dotenv';

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
    // - should we also check if the existing token is still valid?
    // Get existing token OR login if no existing token
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
