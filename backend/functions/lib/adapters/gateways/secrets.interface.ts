import { Context } from '../types/basic';

export interface SecretsInterface {
  getSecret(name: string, context: Context): Promise<string>;
  setSecret(name: string, value: string, context: Context): Promise<string>;
}
