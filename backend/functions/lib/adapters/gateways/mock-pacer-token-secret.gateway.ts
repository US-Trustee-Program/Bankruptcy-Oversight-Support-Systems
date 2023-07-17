import { PacerSecretsInterface } from './pacer-secrets.interface';
import { NoPacerToken } from './pacer-exceptions';
import { ApplicationContext } from '../types/basic';

export class MockPacerTokenSecretGateway implements PacerSecretsInterface {
  hasToken: boolean;
  private _token: string = 'abcdefghijklmnopqrstuvwxyz1234567890';

  constructor(hasToken: boolean) {
    this.hasToken = hasToken;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getPacerTokenFromSecrets(context: ApplicationContext): Promise<string> {
    if (this.hasToken) {
      return Promise.resolve(this._token);
    }
    throw new NoPacerToken();
  }

  savePacerTokenToSecrets(context: ApplicationContext, token: string): Promise<void> {
    this._token = token;
    return Promise.resolve(undefined);
  }

  getPacerPasswordFromSecrets(): Promise<string> {
    return Promise.resolve('fake-password');
  }

  getPacerUserIdFromSecrets(): Promise<string> {
    return Promise.resolve('fake-user-id');
  }
}
