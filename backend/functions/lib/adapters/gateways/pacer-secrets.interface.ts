import { Context } from '../types/basic';

export interface PacerSecretsInterface {
  getPacerTokenFromSecrets(context: Context): Promise<string>;
  savePacerTokenToSecrets(context: Context, token: string): Promise<void>;
  getPacerUserIdFromSecrets(context: Context): Promise<string>;
  getPacerPasswordFromSecrets(context: Context): Promise<string>;
}
