export const CamsRole = {
  PrivilegedIdentityUser: 'PrivilegedIdentityUser',
  SuperUser: 'SuperUser',
  CaseAssignmentManager: 'CaseAssignmentManager',
  TrialAttorney: 'TrialAttorney',
  LeadTrialAttorney: 'LeadTrialAttorney',
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

/**
 * The roles a CAMS permission (role assignment) can grant: every unique CamsRole value except
 * PrivilegedIdentityUser, which is managed separately. The Oversight* keys alias other values and
 * drop out.
 */
export const CamsRoles: CamsRoleType[] = [...new Set(Object.values(CamsRole))].filter(
  (role) => role !== CamsRole.PrivilegedIdentityUser,
);

export const AssignableRole = {
  TrialAttorney: CamsRole.TrialAttorney,
  LeadTrialAttorney: CamsRole.LeadTrialAttorney,
} as const;

export type AssignableRoleType = (typeof AssignableRole)[keyof typeof AssignableRole];

export const OversightRoles = [
  CamsRole.OversightAttorney,
  CamsRole.OversightAuditor,
  CamsRole.OversightParalegal,
] as const;

export type OversightRoleType = (typeof OversightRoles)[number];
