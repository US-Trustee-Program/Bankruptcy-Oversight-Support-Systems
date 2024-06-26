export type CamsUser = {
  name: string;
};

export type CamsSession = {
  user: CamsUser;
  apiToken: string;
  provider: string;
  validatedClaims: { [key: string]: unknown };
};
