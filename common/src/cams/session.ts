import { CamsUser, CamsUserReference } from './users';

export type CamsSession = {
  accessToken: string;
  expires: number;
  issuer: string;
  provider: string;
  user: CamsUser;
};

export function getCamsUserReference<T extends CamsUserReference>(user: T): CamsUserReference {
  const { id, name } = user;
  return { id, name };
}
