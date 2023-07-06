import { Context } from '../types/basic';

export interface PacerSecretsInterface {
  getPacerTokenFromSecrets(context: Context): Promise<string>;
  savePacerTokenToSecrets(token: string, context: Context): Promise<void>;
  getPacerUserIdFromSecrets(context: Context): Promise<string>;
  getPacerPasswordFromSecrets(context: Context): Promise<string>;
}
