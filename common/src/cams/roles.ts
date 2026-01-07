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

export const OversightRole = new Set<CamsRoleType>([
  CamsRole.OversightAttorney,
  CamsRole.OversightAuditor,
  CamsRole.OversightParalegal,
]);

export type OversightRoleType =
  | typeof CamsRole.OversightAttorney
  | typeof CamsRole.OversightAuditor
  | typeof CamsRole.OversightParalegal;
