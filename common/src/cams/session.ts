import { CamsUser, CamsUserReference } from './users';

export type CamsSession = {
  user: CamsUser;
  accessToken: string;
  provider: string;
  issuer: string;
  expires: number;
};

export function getCamsUserReference<T extends CamsUserReference>(user: T): CamsUserReference {
  const { id, name, email } = user;
  const userRef: CamsUserReference = { id, name };
  if (email) userRef.email = email;
  return userRef;
}
