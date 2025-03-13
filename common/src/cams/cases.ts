import { DebtorAttorney, Party } from './parties';
import { ConsolidationFrom, ConsolidationTo, TransferFrom, TransferTo } from './events';
import { CaseAssignment } from './assignments';
import { Auditable } from './auditable';
import { CamsUserReference } from './users';

export type FlatOfficeDetail = {
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
};

export type CaseBasics = FlatOfficeDetail & {
  dxtrId: string; // TODO: Refactor this out so it doesn't leak to the UI.
  caseId: string;
  caseNumber?: string;
  chapter: string;
  caseTitle: string;
  dateFiled: string;
  petitionCode?: string;
  petitionLabel?: string;
  debtorTypeCode?: string;
  debtorTypeLabel?: string;
  assignments?: CaseAssignment[];
};

export type CaseSummary = CaseBasics & {
  debtor: Party;
};

export type CaseDetail = CaseSummary & {
  closedDate?: string;
  dismissedDate?: string;
  reopenedDate?: string;
  transferDate?: string;
  transfers?: Array<TransferFrom | TransferTo>;
  consolidation?: Array<ConsolidationTo | ConsolidationFrom>;
  debtorAttorney?: DebtorAttorney;
  judgeName?: string;
};

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

export type CaseNote = CaseNoteInput &
  Auditable & {
    id?: string;
    documentType: 'NOTE';
    archivedOn?: string;
    archivedBy?: CamsUserReference;
  };

export type CaseNoteDeleteRequest = {
  id: string;
  caseId: string;
  userId: string;
  sessionUser: CamsUserReference;
};

export type CaseNoteInput = {
  title: string;
  caseId: string;
  content: string;
  updatedBy?: CamsUserReference;
};

export type DxtrCase = CaseSummary & {
  closedDate?: string;
  dismissedDate?: string;
  reopenedDate?: string;
};

export type SyncedCase = DxtrCase &
  Auditable & {
    documentType: 'SYNCED_CASE';
    id?: string;
  };
