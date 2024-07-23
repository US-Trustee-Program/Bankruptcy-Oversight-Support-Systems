import { OfficeDetails } from './courts';

// TODO: move this somewhere else?
export type CamsRole = string;
// const CamsRoles = {
//   CaseAssignmentManager: 'USTP_CAMS_Case_Assignment_Manager',
//   TrialAttorney: 'USTP_CAMS_Trial_Attorney',
// } as const;

export type CamsUser = {
  name: string;
  offices?: OfficeDetails[];
  roles?: CamsRole[];
};

// const user: CamsUser = {
//   name: 'bob',
//   roles: [CamsRoles.CaseAssignmentManager],
// };

export type CamsSession = {
  user: CamsUser;
  accessToken: string;
  provider: string;
  issuer: string;
  expires: number;
};
