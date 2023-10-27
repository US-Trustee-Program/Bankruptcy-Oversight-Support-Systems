export type ColumnNames = Array<string>;

export type Chapter = '12' | '15';
export type TxCode = 'CBC' | 'CDC' | 'OCO';
export type TxType = 'O';

export interface TableRecordHelper {
  validate(): void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toInsertableArray(): Array<any>;
}
