import { OfficeDetails } from './courts';

export enum CamsRole {
  SuperUser = 'SuperUser',
  CaseAssignmentManager = 'CaseAssignmentManager',
  TrialAttorney = 'TrialAttorney',
}

export type CamsUserReference = {
  id: string;
  name: string;
};

export type CamsUser = CamsUserReference & {
  offices?: OfficeDetails[];
  roles?: CamsRole[];
};

export type CamsSession = {
  user: CamsUser;
  accessToken: string;
  provider: string;
  issuer: string;
  expires: number;
};

export function getCamsUserReference<T extends CamsUserReference>(user: T): CamsUserReference {
  const { id, name } = user;
  return { id, name };
}
