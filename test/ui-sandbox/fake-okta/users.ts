export type FakeOktaUser = {
  sub: string;
  name: string;
  email: string;
  groups: string[];
};

export const OKTA_DB_NAME = 'okta';
export const OKTA_USERS_COLLECTION = 'users';
