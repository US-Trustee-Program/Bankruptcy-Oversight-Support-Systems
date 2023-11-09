import { ColumnNames, TableRecordHelper } from '../types';
import { toSqlInsertStatements } from '../utility';

export const AO_GRP_DES_TableName = 'AO_GRP_DES';
export const AO_GRP_DES_InsertableColumnNames: ColumnNames = ['GRP_DES', 'REGION_ID'];
export const AO_GRP_DES_ColumnNames: ColumnNames = [...AO_GRP_DES_InsertableColumnNames];
export interface AO_GRP_DES_RecordProps {
  GRP_DES: string;
  REGION_ID: string;
}
export class AO_GRP_DES_Record implements TableRecordHelper {
  GRP_DES: string = '';
  REGION_ID: string = '';

  constructor(props: AO_GRP_DES_RecordProps) {
    Object.assign(this, props);
  }
  validate(): void {
    /// TODO: implement this schema validation
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toInsertableArray(): any[] {
    return [this.GRP_DES, this.REGION_ID];
  }
}
export function toAoGrpDesInsertStatements(records: Array<AO_GRP_DES_Record>): string[] {
  return toSqlInsertStatements(AO_GRP_DES_TableName, AO_GRP_DES_InsertableColumnNames, records);
}
