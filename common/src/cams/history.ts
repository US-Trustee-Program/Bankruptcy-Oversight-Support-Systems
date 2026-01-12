import { CaseAssignment } from './assignments';
import { Auditable } from './auditable';
import { CaseSummary } from './cases';
import { OrderStatus, TransferOrder } from './orders';

export interface ConsolidationOrderSummary {
  status: OrderStatus;
  leadCase?: CaseSummary;
  memberCases: Array<CaseSummary>;
  reason?: string;
}

export function isConsolidationHistory(history: unknown): history is ConsolidationOrderSummary {
  // TODO: This is still pretty ambiguous. We may want to consider hoisting the documentType
  // here OR coming up with a "type" name system if we don't want to lead Cosmos implementation
  // details through the API.
  // The probability that a non-consolidation history object will satisfy this expression
  // ISVERY HIGH!
  return typeof history === 'object' && history !== null && 'status' in history;
}

type AbstractCaseHistory<B, A> = Auditable & {
  id?: string;
  caseId: string;
  before: B;
  after: A;
};

export type CaseAssignmentHistory = AbstractCaseHistory<CaseAssignment[], CaseAssignment[]> & {
  documentType: 'AUDIT_ASSIGNMENT';
};

export type CaseTransferHistory = AbstractCaseHistory<TransferOrder | null, TransferOrder> & {
  documentType: 'AUDIT_TRANSFER';
};

export type CaseConsolidationHistory = AbstractCaseHistory<
  ConsolidationOrderSummary | null,
  ConsolidationOrderSummary
> & {
  documentType: 'AUDIT_CONSOLIDATION';
};

export type CaseHistory = CaseAssignmentHistory | CaseTransferHistory | CaseConsolidationHistory;
