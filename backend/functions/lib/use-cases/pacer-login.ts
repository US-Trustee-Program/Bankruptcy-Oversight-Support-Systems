import { Context } from '../adapters/types/basic';
import * as dotenv from 'dotenv';

dotenv.config();

namespace UseCases {
  export class PacerLogin {
    private readonly functionContext: Context;

    async getPacerToken(context: Context): Promise<string> {
      // Get existing token OR login if no existing token
      // - should we also check if the existing token is still valid?
      return process.env.PACER_TOKEN;
    }
  }
}

export default UseCases.PacerLogin;
