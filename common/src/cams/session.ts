import { CamsUser, CamsUserReference } from './users';

export type CamsSession = {
  user: CamsUser;
  accessToken: string;
  provider: string;
  issuer: string;
  expires: number;
};

export function getCamsUserReference<T extends CamsUserReference>(user: T): CamsUserReference {
  const { id, name, roles } = user;
  return { id, name, roles };
}
