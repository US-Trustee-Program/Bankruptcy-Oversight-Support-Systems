import { PacerSecretsInterface } from './pacer-secrets.interface';
import { NoPacerToken } from './pacer-exceptions';
import { Context } from '../types/basic';

export class MockPacerTokenSecretGateway implements PacerSecretsInterface {
  hasToken: boolean;
  private _token: string = 'abcdefghijklmnopqrstuvwxyz1234567890';

  constructor(hasToken: boolean) {
    this.hasToken = hasToken;
  }

  getPacerTokenFromSecrets(context: Context): Promise<string> {
    if (this.hasToken) {
      return Promise.resolve(this._token);
    }
    throw new NoPacerToken();
  }

  savePacerTokenToSecrets(context: Context, token: string): Promise<void> {
    this._token = token;
    return Promise.resolve(undefined);
  }

  getPacerPasswordFromSecrets(context: Context): Promise<string> {
    return Promise.resolve('fake-password');
  }

  getPacerUserIdFromSecrets(context: Context): Promise<string> {
    return Promise.resolve('fake-user-id');
  }
}
