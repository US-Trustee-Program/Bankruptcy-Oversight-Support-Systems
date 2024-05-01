import { SimpleResponseData, ResponseData } from './api';
import * as CommonOrders from '@common/cams/orders';
import { OfficeDetails } from '@common/cams/courts';
import { EventCaseReference } from '@common/cams/events';
import { CaseAssignment } from '@common/cams/assignments';

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
    caseList: Array<Chapter15Type>;
  };
}

export interface Chapter15CaseSummaryResponseData extends ResponseData {
  body: CaseSummary;
}

export interface Chapter15CaseDetailsResponseData extends ResponseData {
  body: {
    caseDetails: CaseDetail;
  };
}

export interface CaseAssignmentHistoryResponseData extends ResponseData {
  body: CaseAssignmentHistory[];
}

export interface CaseAssociatedCasesResponseData extends ResponseData {
  body: EventCaseReference[];
}

export type TransferOrder = CommonOrders.TransferOrder & {
  id: string;
};

export type ConsolidationOrder = CommonOrders.ConsolidationOrder & {
  id: string;
};

export type Order = CommonOrders.Order & {
  id: string;
};

export interface OrderResponseData extends ResponseData {
  body: Array<Order>;
}

export interface OfficesResponseData extends ResponseData {
  body: OfficeDetails[];
}

export type CaseAssignmentResponseData = SimpleResponseData<Array<CaseAssignment>>;

export interface RegionDetails {
  regionId: string;
  regionName: string;
}
