export interface DxtrTransactionRecord {
  txCode: string;
  txRecord: string;
}

export interface TransactionDates {
  closedDates?: Date[];
  dismissedDates?: Date[];
  reopenedDates?: Date[];
  transferDates?: Date[];
}
