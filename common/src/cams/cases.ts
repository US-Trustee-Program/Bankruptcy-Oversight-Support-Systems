import { DebtorAttorney, Debtor, LegacyTrustee } from './parties';
import {
  Consolidation,
  ConsolidationFrom,
  ConsolidationTo,
  TransferFrom,
  TransferTo,
} from './events';
import { CaseAssignment } from './assignments';
import { Auditable } from './auditable';
import { CamsUserReference } from './users';
import { ConsolidationType } from './orders';

export const VALID_CASEID_PATTERN = new RegExp(/^[\dA-Z]{3}-\d{2}-\d{5}$/);

type FlatOfficeDetail = {
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
  debtor: Debtor;
  jointDebtor?: Debtor;
};

export type CaseDetail = CaseSummary & {
  closedDate?: string;
  dismissedDate?: string;
  reopenedDate?: string;
  transferDate?: string;
  transfers?: Array<TransferFrom | TransferTo>;
  consolidation: Array<ConsolidationTo | ConsolidationFrom>;
  debtorAttorney?: DebtorAttorney;
  jointDebtorAttorney?: DebtorAttorney;
  judgeName?: string;
  trustee?: LegacyTrustee;
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
    documentType: 'NOTE';
    updatedBy: CamsUserReference;
    updatedOn: string;
    createdBy: CamsUserReference;
    createdOn: string;
    archivedOn?: string;
    archivedBy?: CamsUserReference;
    previousVersionId?: string;
  };

export type CaseNoteDeleteRequest = {
  id: string;
  caseId: string;
  sessionUser: CamsUserReference;
};

export type CaseNoteEditRequest = {
  note: Partial<CaseNote>;
  sessionUser: CamsUserReference;
};

export type CaseNoteInput = {
  id?: string;
  title: string;
  caseId: string;
  content: string;
  updatedBy?: CamsUserReference;
  updatedOn?: string;
  createdBy?: CamsUserReference;
  createdOn?: string;
};

type ClosedDismissedReopened = {
  closedDate?: string;
  dismissedDate?: string;
  reopenedDate?: string;
};

export type DxtrCase = CaseSummary & ClosedDismissedReopened;

export type SyncedCase = DxtrCase &
  Auditable & {
    documentType: 'SYNCED_CASE';
    id?: string;
  };

export function isCaseClosed<T extends ClosedDismissedReopened>(bCase: T) {
  const { closedDate, reopenedDate } = bCase;
  return closedDate ? (reopenedDate ? closedDate >= reopenedDate : true) : false;
}

export function isCaseOpen<T extends ClosedDismissedReopened>(bCase: T) {
  return !isCaseClosed(bCase);
}

export function isLeadCase(bCase: CaseDetail) {
  return bCase.consolidation[0]?.documentType === 'CONSOLIDATION_FROM';
}

export function isChildCase(bCase: CaseDetail) {
  return bCase.consolidation[0]?.documentType === 'CONSOLIDATION_TO';
}

export function isTransferredCase(bCase: CaseDetail) {
  const documentType = bCase.transfers?.[0]?.documentType;
  return documentType === 'TRANSFER_FROM' || documentType === 'TRANSFER_TO';
}

export function getCaseConsolidationType(
  consolidation: Consolidation[],
  consolidationTypeMap: Map<ConsolidationType, string>,
): string {
  return consolidationTypeMap.get(consolidation[0]?.consolidationType) ?? '';
}

export function getLeadCaseLabel(consolidationType: string): string {
  return consolidationType ? `Lead case in ${consolidationType.toLocaleLowerCase()}` : 'Lead case';
}

export function getMemberCaseLabel(consolidationType: string): string {
  return consolidationType
    ? `Member case in ${consolidationType.toLocaleLowerCase()}`
    : 'Member case';
}

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
  return { divisionCode, caseNumber };
}
