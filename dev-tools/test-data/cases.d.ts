export interface CaseListRecordSet {
  caseList: CaseDetail[];
  initialized?: boolean;
}

export interface CaseDetailsDbResult {
  success: boolean;
  message: string;
  body: {
    caseDetails: CaseDetail;
  };
}

export interface Party {
  name: string;
  address1?: string;
  address2?: string;
  address3?: string;
  cityStateZipCountry?: string;
  taxId?: string;
  ssn?: string;
}
export interface DebtorAttorney {
  name: string;
  address1?: string;
  address2?: string;
  address3?: string;
  cityStateZipCountry?: string;
  phone?: string;
}
export interface CaseDetail {
  caseId: string;
  chapter: string;
  caseTitle: string;
  dateFiled: string;
  closedDate?: string;
  dismissedDate?: string;
  reopenedDate?: string;
  dxtrId?: string;
  courtId?: string;
  assignments?: string[];
  judgeName?: string;
  debtor?: Party;
  debtorAttorney?: DebtorAttorney;
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
