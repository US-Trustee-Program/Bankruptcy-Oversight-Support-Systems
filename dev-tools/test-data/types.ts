export type ColumnNames = Array<string>;

export type Chapter = '12' | '15';
export type TxCode = 'CBC' | 'CDC' | 'OCO' | '1';
export type TxType = 'O' | '1'; // Yes, that is a Oh not a Zero. The "O" stands for _O_rder

export interface TableRecordHelper {
  validate(): void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toInsertableArray(): Array<any>;
}

/*
CB - Corporate Business
FD - Foreign Debtor
IB - Individual Business
IC - Individual Consumer
JC - Joint Consumer
MU - Municipality
PB - Partnership Business
*/
export type DebtorType = 'CB' | 'FD' | 'IB' | 'IC' | 'JC' | 'MU' | 'PB';
