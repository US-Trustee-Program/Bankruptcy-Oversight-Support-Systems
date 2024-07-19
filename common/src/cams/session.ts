export type CamsUser = {
  name: string;
};

export type CamsSession = {
  user: CamsUser;
  accessToken: string;
  provider: string;
  expires: number;
  validatedClaims: { [key: string]: unknown };
};
