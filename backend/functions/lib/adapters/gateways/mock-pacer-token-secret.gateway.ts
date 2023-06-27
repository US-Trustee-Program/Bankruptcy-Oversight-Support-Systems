import { PacerTokenSecretInterface } from './pacer-token-secret.interface';
import { NoPacerToken } from './pacer-exceptions';

export class MockPacerTokenSecretGateway implements PacerTokenSecretInterface {
  hasToken: boolean;
  private _token: string = 'abcdefghijklmnopqrstuvwxyz1234567890';

  constructor(hasToken: boolean) {
    this.hasToken = hasToken;
  }

  getPacerTokenFromSecrets(): Promise<string> {
    if (this.hasToken) {
      return Promise.resolve(this._token);
    }
    throw new NoPacerToken();
  }

  savePacerTokenToSecrets(token: string): Promise<void> {
    this._token = token;
    return Promise.resolve(undefined);
  }
}
