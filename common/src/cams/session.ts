export const MOCK_AUTHORIZATION_BEARER_TOKEN = 'MOCK_ACCESS_TOKEN_JWT';

export type CamsUser = {
  name: string;
};

export type CamsSession = {
  user: CamsUser;
  apiToken: string;
  provider: string;
  validatedClaims: { [key: string]: unknown };
};
