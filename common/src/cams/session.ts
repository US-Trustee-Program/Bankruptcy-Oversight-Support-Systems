import { OfficeDetails } from './courts';

export enum CamsRole {
  CaseAssignmentManager = 'USTP_CAMS_Case_Assignment_Manager',
  TrialAttorney = 'USTP_CAMS_Trial_Attorney',
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
