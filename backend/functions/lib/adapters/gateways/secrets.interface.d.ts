import { ApplicationContext } from '../types/basic';

export interface SecretsInterface {
  getSecret(context: ApplicationContext, name: string): Promise<string>;
  setSecret(context: ApplicationContext, name: string, value: string): Promise<string>;
}
