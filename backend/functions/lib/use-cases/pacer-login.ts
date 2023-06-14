import { Context } from '../adapters/types/basic';
import * as dotenv from 'dotenv';
import { axiosPost } from '../adapters/utils/http';

dotenv.config ();



namespace UseCases {
  export class PacerLogin {
    private readonly functionContext: Context;

    async getPacerToken(context: Context): Promise<string> {
      const response = await axiosPost({
        url: 'https://qa-login.uscourts.gov/services/cso-auth',
        body: {
          'loginId': 'username',
          'password': ''
        },
      });
      if (response.status == 200){
        if (response.data.loginResult != 1){
          Promise.resolve(response.data.nextGenCSO);
        } else {
          Promise.reject('Login Failed');
        }
      } else { 
        Promise.reject('Failed to Connect to PACER API');
      }
      return response;
    // Get existing token OR login if no existing token
    // - should we also check if the existing token is still valid?
    }
  }
}

export default UseCases.PacerLogin;
