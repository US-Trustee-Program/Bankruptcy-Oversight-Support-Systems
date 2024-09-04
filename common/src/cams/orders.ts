import { CaseAssignment } from './assignments';
import { CaseDocketEntry, CaseSummary } from './cases';
import { Consolidation } from './events';

export type OrderStatus = 'pending' | 'approved' | 'rejected';
export type OrderType = 'transfer' | 'consolidation';
export type ConsolidationType = 'administrative' | 'substantive';

export type ConsolidationOrderActionRejection = ConsolidationOrder & {
  rejectedCases: Array<string>;
};

export function isConsolidationOrderRejection(
  body: unknown,
): body is ConsolidationOrderActionRejection {
  return (
    typeof body === 'object' &&
    body !== null &&
    'rejectedCases' in body &&
    'consolidationId' in body &&
    'consolidationType' in body &&
    'orderType' in body &&
    'orderDate' in body &&
    'status' in body &&
    'courtName' in body &&
    'courtDivisionCode' in body &&
    'jobId' in body &&
    'childCases' in body
  );
}

export type ConsolidationOrderActionApproval = ConsolidationOrder & {
  approvedCases: Array<string>;
  leadCase: CaseSummary;
};

export function isConsolidationOrderApproval(
  body: unknown,
): body is ConsolidationOrderActionApproval {
  return (
    typeof body === 'object' &&
    body !== null &&
    'approvedCases' in body &&
    'leadCase' in body &&
    'consolidationId' in body &&
    'consolidationType' in body &&
    'orderType' in body &&
    'orderDate' in body &&
    'status' in body &&
    'courtName' in body &&
    'courtDivisionCode' in body &&
    'jobId' in body &&
    'childCases' in body
  );
}

// TODO: TransferOrder needs to NOT extend CaseSummary!! HOwever this is currently mapped from a flat SQL query response from DXTR.
export type TransferOrder = CaseSummary & {
  id: string;
  orderType: 'transfer';
  orderDate: string;
  status: OrderStatus;
  docketEntries: CaseDocketEntry[];
  docketSuggestedCaseNumber?: string;
  newCase?: CaseSummary;
  reason?: string;
};

// TODO: Helper function while we are in transition to remodel "has a".
export function getCaseSummaryFromTransferOrder(order: TransferOrder) {
  return {
    caseId: order.caseId,
    caseTitle: order.caseTitle,
    courtId: order.courtId,
    courtDivisionCode: order.courtDivisionCode,
    courtDivisionName: order.courtDivisionName,
    courtName: order.courtName,
    chapter: order.chapter,
    dateFiled: order.dateFiled,
    debtor: order.debtor,
    dxtrId: order.dxtrId,
    debtorTypeCode: order.debtorTypeCode,
    debtorTypeLabel: order.debtorTypeLabel,
    petitionCode: order.petitionCode,
    petitionLabel: order.petitionLabel,
    state: order.state,
    regionId: order.regionId,
    regionName: order.regionName,
    groupDesignator: order.groupDesignator,
    officeCode: order.officeCode,
    officeName: order.officeName,
  };
}

export type ConsolidationOrder = {
  id?: string;
  deleted?: true;
  consolidationId: string;
  consolidationType: ConsolidationType;
  orderType: 'consolidation';
  orderDate: string;
  status: OrderStatus;
  courtName: string;
  courtDivisionCode: string;
  jobId: number;
  leadCaseIdHint?: string;
  leadCase?: CaseSummary;
  childCases: Array<ConsolidationOrderCase>;
  reason?: string;
};

const consolidationOrderCaseKeys = [
  'docketEntries',
  'orderDate',
  'attorneyAssignments',
  'associations',
];

export type ConsolidationOrderCase = CaseSummary & {
  docketEntries: CaseDocketEntry[];
  orderDate: string;
  attorneyAssignments?: CaseAssignment[];
  associations?: Consolidation[];
};

export function getCaseSummaryFromConsolidationOrderCase(
  order: RawConsolidationOrder | ConsolidationOrderCase,
): CaseSummary {
  const excludedKeys = [...consolidationOrderCaseKeys, ...rawConsolidationOrderKeys];

  const temp: RawConsolidationOrder = { ...(order as RawConsolidationOrder) };
  excludedKeys.forEach((key) => delete temp[key]);

  return temp;
}

const rawConsolidationOrderKeys = ['jobId', 'leadCaseIdHint'];

export type RawConsolidationOrder = ConsolidationOrderCase & {
  jobId: number;
  leadCaseIdHint?: string;
};

export type Order = TransferOrder | ConsolidationOrder;

export function isTransferOrder(order: Order): order is TransferOrder {
  return order.orderType === 'transfer';
}

export function isConsolidationOrder(order: Order): order is ConsolidationOrder {
  return order.orderType === 'consolidation';
}

type TransferOrderActionRejection = {
  id: string;
  caseId: string;
  orderType: 'transfer';
  status: 'rejected';
  reason?: string;
};

type TransferOrderActionApproval = {
  id: string;
  caseId: string;
  orderType: 'transfer';
  newCase: Partial<CaseSummary>;
  status: 'approved';
};

export type TransferOrderAction = TransferOrderActionRejection | TransferOrderActionApproval;

type OrderActionRejection<T = TransferOrder> = {
  id: string;
  status: 'rejected';
  reason?: string;
  order: T;
};

type OrderActionApproval<T = TransferOrder> = {
  id: string;
  status: 'approved';
  order: T;
};

export type OrderAction<T> = OrderActionRejection<T> | OrderActionApproval<T>;

export type OrderSync = {
  consolidations: ConsolidationOrder[];
  transfers: TransferOrder[];
  maxTxId: string;
};

export type RawOrderSync = {
  consolidations: RawConsolidationOrder[];
  transfers: TransferOrder[];
  maxTxId: string;
};

export type FlexibleTransferOrderAction = Partial<TransferOrderAction> & {
  newCase?: Partial<CaseSummary>;
};
