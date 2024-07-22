import { OfficeDetails } from './courts';

export type CamsUser = {
  name: string;
};

export type CamsSession = {
  user: CamsUser;
  accessToken: string;
  provider: string;
  expires: number;
  offices?: OfficeDetails[];
  validatedClaims: { [key: string]: unknown };
};
