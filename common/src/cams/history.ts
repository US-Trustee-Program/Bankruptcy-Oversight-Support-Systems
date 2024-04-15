import { CaseAssignment } from './assignments';
import { CaseSummary } from './cases';
import { OrderStatus, TransferOrder } from './orders';

export interface ConsolidationOrderSummary {
  status: OrderStatus;
  leadCase?: CaseSummary;
  childCases: Array<CaseSummary>;
  reason?: string;
}

export function isConsolidationHistory(history: unknown): history is ConsolidationOrderSummary {
  // TODO: This is still pretty ambiguous. We may want to consider hoisting the documentType
  // here OR coming up with a "type" name system if we don't want to lead Cosmos implementation
  // details through the API.
  // The probability that a non-consolidation history object will satisfy this expression
  // ISVERY HIGH!
  return typeof history === 'object' && 'status' in history;
}

// TODO: Consider a way to make the occurredAtTimestamp optional when creating a record, otherwise it is required.
type AbstractCaseHistory<B, A> = {
  id?: string;
  caseId: string;
  occurredAtTimestamp: string;
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
