import { PacerTokenSecretInterface } from './pacer-token-secret.interface';
import { NoPacerToken } from './pacer-exceptions';

export class MockPacerTokenSecretGateway implements PacerTokenSecretInterface {
  hasToken: boolean;

  constructor(hasToken: boolean) {
    this.hasToken = hasToken;
  }

  getPacerTokenFromSecrets(): Promise<string> {
    if (this.hasToken) {
      return Promise.resolve('abcdefghijklmnopqrstuvwxyz1234567890');
    }
    throw new NoPacerToken();
  }

  savePacerTokenToSecrets(token: string): Promise<void> {
    return Promise.resolve(undefined);
  }
}
