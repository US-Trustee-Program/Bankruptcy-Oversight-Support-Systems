import { httpPost } from '../utils/http';
import * as dotenv from 'dotenv';

dotenv.config();

export default class PacerLogin {

  async getPacerToken(): Promise<string> {
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
    } catch (e) {
      throw(e);
    }
  }
}
