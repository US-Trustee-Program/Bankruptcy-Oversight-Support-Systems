import { OfficeDetails } from './courts';

export enum CamsRole {
  CaseAssignmentManager = 'CaseAssignmentManager',
  TrialAttorney = 'TrialAttorney',
}

export type CamsUser = {
  name: string;
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
