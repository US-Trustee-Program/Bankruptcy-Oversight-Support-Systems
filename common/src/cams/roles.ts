export enum CamsRole {
  PrivilegedIdentityUser = 'PrivilegedIdentityUser',
  SuperUser = 'SuperUser',
  CaseAssignmentManager = 'CaseAssignmentManager',
  TrialAttorney = 'TrialAttorney',
  DataVerifier = 'DataVerifier',
  TrusteeAdmin = 'TrusteeAdmin',
  // OversightAttorney = 'USTP CAMS Trustee Oversight Attorney',
}

export enum AssignableRole {
  TrialAttorney = CamsRole.TrialAttorney,
}

export enum OversightRole {
  // TODO: Convert to using CamsRole.OversightAttorney
  OversightAttorney = CamsRole.TrialAttorney,
}
