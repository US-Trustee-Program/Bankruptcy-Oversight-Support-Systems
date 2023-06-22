export interface PacerTokenSecretInterface {
  getPacerTokenFromSecrets(): Promise<string>;
  savePacerTokenToSecrets(token: string): Promise<void>;
}
