import { CaseAssignment } from './case.assignment';
import { ConsolidationOrder, TransferOrder } from '../../../../../common/src/cams/orders';

// TODO: Consider a way to make the occurredAtTimestamp optional when creating a record, otherwise it is required.
type AbstractCaseHistory<B, A> = {
  id?: string;
  caseId: string;
  occurredAtTimestamp?: string;
  before: B;
  after: A;
};

type CaseAssignmentHistory = AbstractCaseHistory<CaseAssignment[], CaseAssignment[]> & {
  documentType: 'AUDIT_ASSIGNMENT';
};

type CaseTransferHistory = AbstractCaseHistory<TransferOrder | null, TransferOrder> & {
  documentType: 'AUDIT_TRANSFER';
};

type CaseConsolidationHistory = AbstractCaseHistory<
  (ConsolidationOrder & { parent?: string }) | null,
  ConsolidationOrder & { parent?: string }
> & {
  documentType: 'AUDIT_CONSOLIDATION';
};

export type CaseHistory = CaseAssignmentHistory | CaseTransferHistory | CaseConsolidationHistory;
