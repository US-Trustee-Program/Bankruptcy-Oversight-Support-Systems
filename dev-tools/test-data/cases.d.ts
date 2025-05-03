export interface CaseDetail {
  assignments?: string[];
  caseId: string;
  caseTitle: string;
  chapter: string;
  closedDate?: string;
  courtId?: string;
  dateFiled: string;
  debtor?: Party;
  debtorAttorney?: DebtorAttorney;
  dismissedDate?: string;
  dxtrId?: string;
  judgeName?: string;
  reopenedDate?: string;
}

export interface CaseDetailsDbResult {
  body: {
    caseDetails: CaseDetail;
  };
  message: string;
  success: boolean;
}

export interface CaseListRecordSet {
  caseList: CaseDetail[];
  initialized?: boolean;
}
export interface DebtorAttorney {
  address1?: string;
  address2?: string;
  address3?: string;
  cityStateZipCountry?: string;
  name: string;
  phone?: string;
}
export interface DxtrTransactionRecord {
  txCode: string;
  txRecord: string;
}

export interface Party {
  address1?: string;
  address2?: string;
  address3?: string;
  cityStateZipCountry?: string;
  name: string;
  ssn?: string;
  taxId?: string;
}

export interface TransactionDates {
  closedDates?: Date[];
  dismissedDates?: Date[];
  reopenedDates?: Date[];
}
