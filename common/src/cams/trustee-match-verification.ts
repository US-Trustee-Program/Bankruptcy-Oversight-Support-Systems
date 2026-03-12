import { Auditable } from './auditable';
import {
  CandidateScore,
  DxtrTrusteeParty,
  TrusteeAppointmentSyncErrorCode,
} from './dataflow-events';

export type TrusteeMatchVerificationStatus = 'pending' | 'resolved' | 'dismissed';

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
