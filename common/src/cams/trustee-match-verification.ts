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
  mismatchReason?: TrusteeAppointmentSyncErrorCode;
  matchCandidates: CandidateScore[];
  status: OrderStatus;
  resolvedTrusteeId?: string;
  resolvedTrusteeName?: string;
  courtName?: string;
  taskType: 'trustee-match';
  reason?: string;
  inactiveAppointmentStatus?: AppointmentStatus;
  taskDate: string | Date;
  /**
   * Compound ACMS key ("{GROUP_DESIGNATOR}-{PROF_CODE}") carried from the source
   * DXTR event, so approval can persist a trustee-professional-ids mapping without
   * re-deriving it. Undefined when the source event had no resolvable professional code.
   */
  acmsProfessionalId?: string;
  /**
   * The court's actual appointment date, carried from the source DXTR event's
   * appointedDate. Distinct from the approval timestamp used for assignedOn.
   */
  appointedDate?: string;
};

/**
 * The projected shape returned by repository.search(). Auditable fields
 * (createdOn, createdBy, updatedOn, updatedBy) are excluded by the MongoDB
 * projection; matchCandidates is retained so the use-case can compute
 * candidateCount and preselectedCandidate before stripping it.
 */
export type TrusteeMatchVerificationSearchResult = Omit<TrusteeMatchVerification, keyof Auditable>;

export type TrusteeCandidate = { trusteeId: string; trusteeName: string };

export type TrusteeMatchVerificationListItem = Pick<
  TrusteeMatchVerification,
  | 'id'
  | 'documentType'
  | 'caseId'
  | 'courtId'
  | 'courtName'
  | 'dxtrTrustee'
  | 'mismatchReason'
  | 'status'
  | 'resolvedTrusteeId'
  | 'resolvedTrusteeName'
  | 'taskType'
  | 'taskDate'
  | 'reason'
  | 'inactiveAppointmentStatus'
> & {
  preselectedCandidate: TrusteeCandidate | null;
  candidateCount: number;
};
