import { CaseDetailInterface } from '../../../../../common/src/cams/cases';

export interface CaseListRecordSet {
  caseList: CaseDetailInterface[];
  initialized?: boolean;
}

export interface CaseListDbResult {
  success: boolean;
  message: string;
  count: number;
  body: CaseListRecordSet;
}

export interface CaseDetailsDbResult {
  success: boolean;
  message: string;
  body: {
    caseDetails: CaseDetailInterface;
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

export { CaseDetailInterface };
