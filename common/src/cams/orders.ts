import { CaseAssignment } from './assignments';
import { CaseDocketEntry, CaseSummary } from './cases';
import { CamsDocument } from './document';
import { Consolidation } from './events';

export type ConsolidationOrder = CamsDocument & {
  childCases: Array<ConsolidationOrderCase>;
  consolidationId: string;
  consolidationType: ConsolidationType;
  courtDivisionCode: string;
  courtName: string;
  deleted?: true;
  jobId: number;
  leadCase?: CaseSummary;
  leadCaseIdHint?: string;
  orderDate: string;
  orderType: 'consolidation';
  reason?: string;
  status: OrderStatus;
};
export type ConsolidationOrderActionApproval = ConsolidationOrder & {
  approvedCases: Array<string>;
  leadCase: CaseSummary;
};
export type ConsolidationOrderActionRejection = ConsolidationOrder & {
  rejectedCases: Array<string>;
};

export type ConsolidationType = 'administrative' | 'substantive';

export type OrderStatus = 'approved' | 'pending' | 'rejected';

export type OrderType = 'consolidation' | 'transfer';

// TODO: TransferOrder needs to NOT extend CaseSummary!! However this is currently mapped from a flat SQL query response from DXTR.
export type TransferOrder = CaseSummary & {
  docketEntries: CaseDocketEntry[];
  docketSuggestedCaseNumber?: string;
  id: string;
  newCase?: CaseSummary;
  orderDate: string;
  orderType: 'transfer';
  reason?: string;
  status: OrderStatus;
};

// TODO: Helper function while we are in transition to remodel "has a".
export function getCaseSummaryFromTransferOrder(order: TransferOrder) {
  return {
    caseId: order.caseId,
    caseTitle: order.caseTitle,
    chapter: order.chapter,
    courtDivisionCode: order.courtDivisionCode,
    courtDivisionName: order.courtDivisionName,
    courtId: order.courtId,
    courtName: order.courtName,
    dateFiled: order.dateFiled,
    debtor: order.debtor,
    debtorTypeCode: order.debtorTypeCode,
    debtorTypeLabel: order.debtorTypeLabel,
    dxtrId: order.dxtrId,
    groupDesignator: order.groupDesignator,
    officeCode: order.officeCode,
    officeName: order.officeName,
    petitionCode: order.petitionCode,
    petitionLabel: order.petitionLabel,
    regionId: order.regionId,
    regionName: order.regionName,
    state: order.state,
  };
}

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

const consolidationOrderCaseKeys = [
  'docketEntries',
  'orderDate',
  'attorneyAssignments',
  'associations',
];

export type ConsolidationOrderCase = CaseSummary & {
  associations?: Consolidation[];
  attorneyAssignments?: CaseAssignment[];
  docketEntries: CaseDocketEntry[];
  orderDate: string;
};

export function getCaseSummaryFromConsolidationOrderCase(
  order: ConsolidationOrderCase | RawConsolidationOrder,
): CaseSummary {
  const excludedKeys = [...consolidationOrderCaseKeys, ...rawConsolidationOrderKeys];

  const temp: RawConsolidationOrder = { ...(order as RawConsolidationOrder) };
  excludedKeys.forEach((key) => delete temp[key]);

  return temp;
}

const rawConsolidationOrderKeys = ['jobId', 'leadCaseIdHint'];

export type FlexibleTransferOrderAction = Partial<TransferOrderAction> & {
  newCase?: Partial<CaseSummary>;
};

export type Order = ConsolidationOrder | TransferOrder;

export type OrderAction<T> = OrderActionApproval<T> | OrderActionRejection<T>;

export type OrderActionApproval<T = TransferOrder> = {
  id: string;
  order: T;
  status: 'approved';
};

export type OrderActionRejection<T = TransferOrder> = {
  id: string;
  order: T;
  reason?: string;
  status: 'rejected';
};

export type OrderSync = {
  consolidations: ConsolidationOrder[];
  maxTxId: string;
  transfers: TransferOrder[];
};

export type RawConsolidationOrder = ConsolidationOrderCase & {
  jobId: number;
  leadCaseIdHint?: string;
};

export type RawOrderSync = {
  consolidations: RawConsolidationOrder[];
  maxTxId: string;
  transfers: TransferOrder[];
};

export type TransferOrderAction = TransferOrderActionApproval | TransferOrderActionRejection;

export type TransferOrderActionApproval = {
  caseId: string;
  id: string;
  newCase: Partial<CaseSummary>;
  orderType: 'transfer';
  status: 'approved';
};

export type TransferOrderActionRejection = {
  caseId: string;
  id: string;
  orderType: 'transfer';
  reason?: string;
  status: 'rejected';
};

export function isConsolidationOrder(order: Order): order is ConsolidationOrder {
  return order.orderType === 'consolidation';
}

export function isTransferOrder(order: Order): order is TransferOrder {
  return order.orderType === 'transfer';
}
