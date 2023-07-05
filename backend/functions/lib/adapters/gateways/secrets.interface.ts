export interface SecretsInterface {
  getSecret(name: string): Promise<string>;
  setSecret(name: string, value: string): Promise<string>;
}
