import { Context } from '../adapters/types/basic';
import * as dotenv from 'dotenv';
import { axiosPost } from '../adapters/utils/http';

dotenv.config();

namespace UseCases {
  export class PacerLogin {
    private readonly functionContext: Context;

    async getPacerToken(context: Context): Promise<string> {
      // Get existing token OR login if no existing token
      try {
        const response = await axiosPost({
          url: process.env.PACER_TOKEN_URL, //'https://qa-login.uscourts.gov/services/cso-auth',
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
        // - should we also check if the existing token is still valid?
        return response;
      } catch (e) {
        console.log('PacerLogin.getPacerToken uscourts.gov rejected with a Failed Response');
        console.log(e);
      }
    }
  }
}

export default UseCases.PacerLogin;
