import { ResponseData } from './api';

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
  courtDivisionName?: string;
  closedDate?: string;
  dismissedDate?: string;
  reopenedDate?: string;
  regionId?: string;
  assignments: string[];
  debtor: Debtor;
  debtorAttorney?: DebtorAttorney;
  debtorTypeLabel: string;
  petitionLabel: string;
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

export interface CaseStaffAssignmentHistory {
  id?: string;
  documentType: 'ASSIGNMENT_HISTORY';
  caseId: string;
  occurredAtTimestamp: string;
  previousAssignments: CaseStaffAssignment[];
  newAssignments: CaseStaffAssignment[];
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

export interface Chapter15CaseDetailsResponseData extends ResponseData {
  body: {
    caseDetails: CaseDetailType;
  };
}

export interface CaseStaffAssignmentHistoryResponseData extends ResponseData {
  body: CaseStaffAssignmentHistory[];
}

export type Order = CaseDocketEntry & {
  id: string;
  caseId: string;
  caseTitle: string;
  chapter: string;
  courtName: string;
  courtDivisionName: string;
  regionId: string;
  orderType: 'transfer';
  orderDate: string;
  status: 'pending' | 'approved' | 'rejected';
  newCaseId?: string;
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
  region: string;
}

export interface OrderTransfer {
  id: string;
  sequenceNumber: number;
  caseId: string;
  newCaseId?: string;
  newCourtName?: string;
  newCourtDivisionName?: string;
  newCourtDivisionCode?: string;
  newRegionId?: string;
  status: OrderStatus;
}

export interface OfficesResponseData extends ResponseData {
  body: OfficeDetails[];
}
