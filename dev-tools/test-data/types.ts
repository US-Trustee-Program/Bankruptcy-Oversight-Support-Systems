export type Chapter = '11' | '12' | '15';

export type ColumnNames = Array<string>;
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
export interface TableRecordHelper {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toInsertableArray(): Array<any>;
  validate(): void;
}

export type TxCode = '1' | 'CBC' | 'CDC' | 'CTO' | 'OCO';

export type TxType = '1' | 'O'; // Yes, that is a Oh not a Zero. The "O" stands for _O_rder
