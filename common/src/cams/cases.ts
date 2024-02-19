import { DebtorAttorney, Party } from './parties';
import { TransferIn, TransferOut } from './events';

export interface CaseSummary {
  caseId: string;
  courtDivision: string;
  chapter: string;
  caseTitle: string;
  dateFiled: string;
  closedDate?: string;
  dismissedDate?: string;
  reopenedDate?: string;
  dxtrId?: string;
  courtId?: string;
  courtName?: string;
  regionId?: string;
  regionName?: string;
  officeName?: string;
  petitionCode?: string;
  petitionLabel?: string;
  courtDivisionName?: string;
  debtor?: Party;
  debtorTypeCode?: string;
  debtorTypeLabel?: string;
}

export interface CaseDetailInterface extends CaseSummary {
  assignments?: string[];
  transfers?: Array<TransferIn | TransferOut>;
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
