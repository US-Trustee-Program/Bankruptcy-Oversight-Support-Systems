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
  sequenceNumber: number;
  fileUri: string;
  fileSize: number;
  fileLabel?: string;
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
