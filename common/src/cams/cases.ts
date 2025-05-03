import { CaseAssignment } from './assignments';
import { Auditable } from './auditable';
import { ConsolidationFrom, ConsolidationTo, TransferFrom, TransferTo } from './events';
import { DebtorAttorney, Party } from './parties';
import { CamsUserReference } from './users';

export type CaseBasics = FlatOfficeDetail & {
  assignments?: CaseAssignment[];
  caseId: string;
  caseNumber?: string;
  caseTitle: string;
  chapter: string;
  dateFiled: string;
  debtorTypeCode?: string;
  debtorTypeLabel?: string;
  dxtrId: string; // TODO: Refactor this out so it doesn't leak to the UI.
  petitionCode?: string;
  petitionLabel?: string;
};

export type CaseDetail = CaseSummary & {
  closedDate?: string;
  consolidation?: Array<ConsolidationFrom | ConsolidationTo>;
  debtorAttorney?: DebtorAttorney;
  dismissedDate?: string;
  judgeName?: string;
  reopenedDate?: string;
  transferDate?: string;
  transfers?: Array<TransferFrom | TransferTo>;
};

export type CaseDocket = Array<CaseDocketEntry>;

export type CaseDocketEntry = {
  dateFiled: string;
  documentNumber?: number;
  documents?: CaseDocketEntryDocument[];
  fullText: string;
  sequenceNumber: number;
  summaryText: string;
};

export type CaseDocketEntryDocument = {
  fileExt?: string;
  fileLabel: string;
  fileSize: number;
  fileUri: string;
};

export type CaseNote = Auditable &
  CaseNoteInput & {
    archivedBy?: CamsUserReference;
    archivedOn?: string;
    createdBy: CamsUserReference;
    createdOn: string;
    documentType: 'NOTE';
    previousVersionId?: string;
    updatedBy: CamsUserReference;
    updatedOn: string;
  };

export type CaseNoteDeleteRequest = {
  caseId: string;
  id: string;
  sessionUser: CamsUserReference;
};

export type CaseNoteEditRequest = {
  note: Partial<CaseNote>;
  sessionUser: CamsUserReference;
};

export type CaseNoteInput = {
  caseId: string;
  content: string;
  createdBy?: CamsUserReference;
  createdOn?: string;
  id?: string;
  title: string;
  updatedBy?: CamsUserReference;
  updatedOn?: string;
};

export type CaseSummary = CaseBasics & {
  debtor: Party;
};

export type DxtrCase = CaseSummary & ClosedDismissedReopened;

export type FlatOfficeDetail = {
  courtDivisionCode: string;
  courtDivisionName: string;
  courtId: string;
  courtName: string;
  groupDesignator: string;
  officeCode: string;
  officeName: string;
  regionId: string;
  regionName: string;
  state?: string;
};

export type SyncedCase = Auditable &
  DxtrCase & {
    documentType: 'SYNCED_CASE';
    id?: string;
  };

type ClosedDismissedReopened = {
  closedDate?: string;
  dismissedDate?: string;
  reopenedDate?: string;
};

export function getCaseIdParts(caseId: string) {
  const parts = caseId.split('-');
  if (
    parts.length !== 3 ||
    parts[0].length !== 3 ||
    parts[1].length !== 2 ||
    parts[2].length !== 5
  ) {
    throw new Error(`Invalid case ID: ${caseId}`);
  }
  const divisionCode = parts[0];
  const caseNumber = `${parts[1]}-${parts[2]}`;
  return { caseNumber, divisionCode };
}

export function isCaseClosed<T extends ClosedDismissedReopened>(bCase: T) {
  const { closedDate, reopenedDate } = bCase;
  return closedDate ? (reopenedDate ? closedDate >= reopenedDate : true) : false;
}

export function isCaseOpen<T extends ClosedDismissedReopened>(bCase: T) {
  return !isCaseClosed(bCase);
}
