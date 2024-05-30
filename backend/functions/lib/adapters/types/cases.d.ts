import { CaseDetail, CaseSummary } from '../../../../../common/src/cams/cases';

export interface CaseSummaryListDbResult {
  success: boolean;
  message: string;
  count: number;
  body: CaseSummary[];
}

export interface CaseDetailsDbResult {
  success: boolean;
  message: string;
  body: {
    caseDetails: CaseDetail;
  };
}

export interface DxtrTransactionRecord {
  txRecord: string;
  txCode: string;
}

export interface TransactionDates {
  closedDates?: Date[];
  dismissedDates?: Date[];
  reopenedDates?: Date[];
}
