export const CamsRole = {
  PrivilegedIdentityUser: 'PrivilegedIdentityUser',
  SuperUser: 'SuperUser',
  CaseAssignmentManager: 'CaseAssignmentManager',
  TrialAttorney: 'TrialAttorney',
  DataVerifier: 'DataVerifier',
  TrusteeAdmin: 'TrusteeAdmin',
  Auditor: 'Auditor',
  Paralegal: 'Paralegal',
  // OversightAttorney: 'USTP CAMS Trustee Oversight Attorney',
} as const;

export type CamsRoleType = (typeof CamsRole)[keyof typeof CamsRole];

export const AssignableRole = {
  TrialAttorney: CamsRole.TrialAttorney,
} as const;

export type AssignableRoleType = (typeof AssignableRole)[keyof typeof AssignableRole];

export const OversightRole = {
  // TODO: Convert to using CamsRole.OversightAttorney
  OversightAttorney: CamsRole.TrialAttorney,
  OversightAuditor: CamsRole.Auditor,
  OversightParalegal: CamsRole.Paralegal,
} as const;

export type OversightRoleType = (typeof OversightRole)[keyof typeof OversightRole];

/*
The reason for having a USTP CAMS Trustee Oversight Attorney separate from
USTP CAMS Trial Attorney is to keep our RBAC granularity based on features
not on AD groups. USTP is free to assign the USTP CAMS Trial Attorney group
as the sole member of the USTP CAMS Trustee Oversight Attorney group, but
has the freedom to change the membership of the group at any time.
*/
