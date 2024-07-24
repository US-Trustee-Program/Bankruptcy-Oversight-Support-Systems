import { OfficeDetails } from './courts';

// TODO: move this somewhere else?
// export type CamsRole = 'USTP_CAMS_Case_Assignment_Manager' | 'USTP_CAMS_Trial_Attorney';
// export const CamsRoles2 = {
//   CaseAssignmentManager: 'USTP_CAMS_Case_Assignment_Manager',
//   TrialAttorney: 'USTP_CAMS_Trial_Attorney',
// } as const;

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
