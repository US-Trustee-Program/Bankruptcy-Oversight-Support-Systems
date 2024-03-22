import { DebtorAttorney, Party } from './parties';
import { ConsolidationFrom, ConsolidationTo, TransferIn, TransferOut } from './events';
import { OfficeDetails } from './courts';

export interface CaseSummary extends OfficeDetails {
  dxtrId: string; // TODO: Refactor this out so it doesn't leak to the UI.
  caseId: string;
  chapter: string;
  caseTitle: string;
  dateFiled: string;
  petitionCode?: string;
  petitionLabel?: string;
  debtorTypeCode?: string;
  debtorTypeLabel?: string;
  debtor: Party;
}

export interface CaseDetail extends CaseSummary {
  closedDate?: string;
  dismissedDate?: string;
  reopenedDate?: string;
  courtId: string;
  assignments?: string[];
  transfers?: Array<TransferIn | TransferOut>;
  consolidation?: Array<ConsolidationTo | ConsolidationFrom>;
  debtorAttorney?: DebtorAttorney;
  judgeName?: string;
}

export type CaseDocketEntryDocument = {
  fileUri: string;
  fileSize: number;
  fileLabel: string;
  fileExt?: string;
};

export type CaseDocketEntry = {
  sequenceNumber: number;
  documentNumber?: number;
  dateFiled: string;
  summaryText: string;
  fullText: string;
  documents?: CaseDocketEntryDocument[];
};

export type CaseDocket = Array<CaseDocketEntry>;
