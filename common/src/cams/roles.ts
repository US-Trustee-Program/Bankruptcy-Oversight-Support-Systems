export enum CamsRole {
  PrivilegedIdentityUser = 'PrivilegedIdentityUser',
  SuperUser = 'SuperUser',
  CaseAssignmentManager = 'CaseAssignmentManager',
  TrialAttorney = 'TrialAttorney',
  DataVerifier = 'DataVerifier',
}

export enum AssignableRole {
  TrialAttorney = CamsRole.TrialAttorney,
}
