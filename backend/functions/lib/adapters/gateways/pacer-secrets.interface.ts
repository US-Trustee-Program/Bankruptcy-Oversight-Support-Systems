export interface PacerSecretsInterface {
  getPacerTokenFromSecrets(): Promise<string>;
  savePacerTokenToSecrets(token: string): Promise<void>;
  getPacerUserIdFromSecrets(): Promise<string>;
  getPacerPasswordFromSecrets(): Promise<string>;
}
