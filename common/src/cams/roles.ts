export enum CamsRole {
  PrivilegedIdentityUser = 'PrivilegedIdentityUser',
  SuperUser = 'SuperUser',
  CaseAssignmentManager = 'CaseAssignmentManager',
  TrialAttorney = 'TrialAttorney',
  DataVerifier = 'DataVerifier',
  TrusteeAdmin = 'TrusteeAdmin',
}

export enum AssignableRole {
  TrialAttorney = CamsRole.TrialAttorney,
}

export enum OversightRole {
  TrialAttorney = CamsRole.TrialAttorney,
}
