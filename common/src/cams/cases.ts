import { DebtorAttorney, Party } from './parties';
import { ConsolidationFrom, ConsolidationTo, TransferFrom, TransferTo } from './events';
import { CamsUserReference } from './users';
import { CaseAssignment } from './assignments';

export interface LegacyOfficeDetails {
  officeName: string;
  officeCode: string;
  courtId: string;
  courtName: string;
  courtDivisionCode: string;
  courtDivisionName: string;
  groupDesignator: string;
  regionId: string;
  regionName: string;
  state?: string;
  staff?: CamsUserReference[];
}

// TODO: Decouple the case model from office details.
// Why do we couple to office details anyhow? It's because we flatten office details
// into case detail in DXTR SQL JOINs.
export interface CaseBasics extends LegacyOfficeDetails {
  dxtrId: string; // TODO: Refactor this out so it doesn't leak to the UI.
  caseId: string;
  chapter: string;
  caseTitle: string;
  dateFiled: string;
  petitionCode?: string;
  petitionLabel?: string;
  debtorTypeCode?: string;
  debtorTypeLabel?: string;
  assignments?: CaseAssignment[];
}

export interface CaseSummary extends CaseBasics {
  debtor: Party;
}

export interface CaseDetail extends CaseSummary {
  closedDate?: string;
  dismissedDate?: string;
  reopenedDate?: string;
  courtId: string;
  transfers?: Array<TransferFrom | TransferTo>;
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
