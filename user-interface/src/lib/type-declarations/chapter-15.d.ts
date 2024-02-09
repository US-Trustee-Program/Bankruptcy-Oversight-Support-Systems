import { ResponseData } from './api';
import * as CommonOrders from '@common/cams/orders';

export interface Chapter15Type {
  caseId: string;
  chapter?: string;
  caseTitle: string;
  dateFiled: string;
  assignments?: string[];
}

export interface Debtor {
  name: string;
  address1?: string;
  address2?: string;
  address3?: string;
  cityStateZipCountry?: string;
  taxId?: string;
  ssn?: string;
}

export interface DebtorAttorney {
  name: string;
  address1?: string;
  address2?: string;
  address3?: string;
  cityStateZipCountry?: string;
  phone?: string;
  email?: string;
  office?: string;
}
interface CaseDetailType {
  caseId: string;
  chapter: string;
  caseTitle: string;
  officeName: string;
  dateFiled: string;
  judgeName?: string;
  courtName?: string;
  courtDivision?: string;
  courtDivisionName?: string;
  closedDate?: string;
  dismissedDate?: string;
  reopenedDate?: string;
  regionId?: string;
  regionName?: string;
  assignments: string[];
  debtor: Debtor;
  debtorAttorney?: DebtorAttorney;
  debtorTypeLabel: string;
  petitionLabel: string;
  transfers?: Transfer[];
}

export interface CaseStaffAssignment {
  id?: string;
  documentType: 'ASSIGNMENT';
  caseId: string;
  name: string;
  role: string;
  assignedOn: string;
  unassignedOn?: string;
}

export interface CaseAssignmentHistory {
  id?: string;
  documentType: 'AUDIT_ASSIGNMENT';
  caseId: string;
  occurredAtTimestamp: string;
  before: CaseStaffAssignment[];
  after: CaseStaffAssignment[];
}

export interface CaseDocketSummaryFacet {
  text: string;
  count: number;
}

export interface CaseDocketEntry {
  sequenceNumber: number;
  documentNumber?: number;
  dateFiled: string;
  summaryText: string;
  fullText: string;
  documents?: CaseDocketEntryDocument[];
}
export type CaseDocket = CaseDocketEntry[];

export interface CaseDocketEntryDocument {
  fileUri: string;
  fileSize: number;
  fileLabel: string;
  fileExt?: string;
}

export interface Chapter15CaseDocketResponseData extends ResponseData {
  body: CaseDocket;
}

export interface Chapter15CaseListResponseData extends ResponseData {
  body: {
    caseList: Array<object>;
  };
}

export interface Chapter15CaseSummaryResponseData extends ResponseData {
  body: CaseDetailType;
}

export interface Chapter15CaseDetailsResponseData extends ResponseData {
  body: {
    caseDetails: CaseDetailType;
  };
}

export interface CaseAssignmentHistoryResponseData extends ResponseData {
  body: CaseAssignmentHistory[];
}

export type Order = CommonOrders.Order & {
  id: string;
};

export interface OrderResponseData extends ResponseData {
  body: Array<Order>;
}

export interface OfficeDetails {
  divisionCode: string;
  groupDesignator: string;
  courtId: string;
  courtName: string;
  officeCode: string;
  officeName: string;
  state: string;
  courtDivisionName: string;
  regionId: string;
  regionName: string;
}

export interface OfficesResponseData extends ResponseData {
  body: OfficeDetails[];
}

export interface RegionDetails {
  regionId: string;
  regionName: string;
}

type AbstractCaseHistory<B, A> = {
  id?: string;
  caseId: string;
  occurredAtTimestamp: string;
  before: B;
  after: A;
};

type CaseAssignmentHistory = AbstractCaseHistory<CaseStaffAssignment[], CaseStaffAssignment[]> & {
  documentType: 'AUDIT_ASSIGNMENT';
};

type CaseTransferHistory = AbstractCaseHistory<Order | null, Order> & {
  documentType: 'AUDIT_TRANSFER';
};

export type CaseHistory = CaseAssignmentHistory | CaseTransferHistory;
