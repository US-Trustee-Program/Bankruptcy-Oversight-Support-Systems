export const CamsRole = {
  PrivilegedIdentityUser: 'PrivilegedIdentityUser',
  SuperUser: 'SuperUser',
  CaseAssignmentManager: 'CaseAssignmentManager',
  TrialAttorney: 'TrialAttorney',
  DataVerifier: 'DataVerifier',
  TrusteeAdmin: 'TrusteeAdmin',
  Auditor: 'Auditor',
  Paralegal: 'Paralegal',
  // TODO: Update the values for these Oversight CamsRoles after we have the USTP groups created
  OversightAttorney: 'TrialAttorney',
  OversightAuditor: 'Auditor',
  OversightParalegal: 'Paralegal',
} as const;

export type CamsRoleType = (typeof CamsRole)[keyof typeof CamsRole];

export const AssignableRole = {
  TrialAttorney: CamsRole.TrialAttorney,
} as const;

export type AssignableRoleType = (typeof AssignableRole)[keyof typeof AssignableRole];

export const OversightRoles = [
  CamsRole.OversightAttorney,
  CamsRole.OversightAuditor,
  CamsRole.OversightParalegal,
] as const;

export type OversightRoleType = (typeof OversightRoles)[number];
