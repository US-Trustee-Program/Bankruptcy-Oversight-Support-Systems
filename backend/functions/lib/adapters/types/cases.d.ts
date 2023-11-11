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
  email?: string;
}
export interface CaseDetailInterface {
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
  officeName?: string;
  petitionLabel?: string;
  courtDivisionName?: string;
  assignments?: string[];
  judgeName?: string;
  debtor?: Party;
  debtorAttorney?: DebtorAttorney;
  debtorTypeLabel?: string;
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
