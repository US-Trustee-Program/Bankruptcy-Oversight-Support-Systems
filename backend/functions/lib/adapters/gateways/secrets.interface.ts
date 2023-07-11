import { Context } from '../types/basic';

export interface SecretsInterface {
  getSecret(context: Context, name: string): Promise<string>;
  setSecret(context: Context, name: string, value: string): Promise<string>;
}
