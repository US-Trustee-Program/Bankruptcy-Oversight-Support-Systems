import { Auditable } from './auditable';
import {
  CandidateScore,
  DxtrTrusteeParty,
  TrusteeAppointmentSyncErrorCode,
} from './dataflow-events';
import { OrderStatus } from './orders';
import { AppointmentStatus } from './trustees';

export const TRUSTEE_MATCH_VERIFICATION_DOCUMENT_TYPE = 'TRUSTEE_MATCH_VERIFICATION' as const;

export type TrusteeMatchVerification = Auditable & {
  id: string;
  documentType: 'TRUSTEE_MATCH_VERIFICATION';
  caseId: string;
  courtId: string;
  dxtrTrustee: DxtrTrusteeParty;
  mismatchReason: TrusteeAppointmentSyncErrorCode;
  matchCandidates: CandidateScore[];
  status: OrderStatus;
  resolvedTrusteeId?: string;
  resolvedTrusteeName?: string;
  courtName?: string;
  orderType: 'trustee-match';
  reason?: string;
  inactiveAppointmentStatus?: AppointmentStatus;
};
