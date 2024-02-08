import { CaseAssignment } from './case.assignment';
import { TransferOrder } from '../../../../../common/src/cams/orders';

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

export type CaseHistory = CaseAssignmentHistory | CaseTransferHistory;
