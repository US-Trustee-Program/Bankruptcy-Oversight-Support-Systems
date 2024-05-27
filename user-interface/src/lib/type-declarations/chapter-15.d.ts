import { ResponseData } from './api';
import { EventCaseReference } from '@common/cams/events';

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
