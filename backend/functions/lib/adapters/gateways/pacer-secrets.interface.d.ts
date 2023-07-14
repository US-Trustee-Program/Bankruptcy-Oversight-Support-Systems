import { ApplicationContext } from '../types/basic';

export interface PacerSecretsInterface {
  getPacerTokenFromSecrets(context: ApplicationContext): Promise<string>;
  savePacerTokenToSecrets(context: ApplicationContext, token: string): Promise<void>;
  getPacerUserIdFromSecrets(context: ApplicationContext): Promise<string>;
  getPacerPasswordFromSecrets(context: ApplicationContext): Promise<string>;
}
