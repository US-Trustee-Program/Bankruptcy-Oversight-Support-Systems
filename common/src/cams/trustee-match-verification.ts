import { Auditable } from './auditable';
import {
  CandidateScore,
  DxtrTrusteeParty,
  TrusteeAppointmentSyncErrorCode,
} from './dataflow-events';

export const TRUSTEE_MATCH_VERIFICATION_DOCUMENT_TYPE = 'TRUSTEE_MATCH_VERIFICATION' as const;

export const TrusteeMatchVerificationStatus = {
  Pending: 'pending',
  Resolved: 'resolved',
  Dismissed: 'dismissed',
} as const;

export type TrusteeMatchVerificationStatus =
  (typeof TrusteeMatchVerificationStatus)[keyof typeof TrusteeMatchVerificationStatus];

export type TrusteeMatchVerification = Auditable & {
  id?: string;
  documentType: 'TRUSTEE_MATCH_VERIFICATION';
  caseId: string;
  courtId: string;
  dxtrTrustee: DxtrTrusteeParty;
  mismatchReason: TrusteeAppointmentSyncErrorCode;
  matchCandidates: CandidateScore[];
  status: TrusteeMatchVerificationStatus;
  resolvedTrusteeId?: string;
};
