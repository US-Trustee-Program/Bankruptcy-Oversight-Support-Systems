import { ColumnNames, TableRecordHelper } from '../types';
import { toSqlInsertStatements } from '../utility';

/*
use AODATEX_SUB
go

create table dbo.AO_REGION
(
    REGION_ID   varchar(2) not null collate SQL_Latin1_General_CP1_CI_AS
        constraint XPKAO_REGION
            primary key,
    REGION_NAME varchar(20) collate SQL_Latin1_General_CP1_CI_AS
)
go
*/

export const AO_REGION_TableName = 'AO_REGION';
export const AO_REGION_InsertableColumnNames: ColumnNames = ['REGION_ID', 'REGION_NAME'];
export const AO_REGION_ColumnNames: ColumnNames = [...AO_REGION_InsertableColumnNames];
export interface AO_REGION_RecordProps {
  REGION_ID: string;
  REGION_NAME: string;
}
export class AO_REGION_Record implements TableRecordHelper {
  REGION_ID: string = '';
  REGION_NAME: string = '';

  constructor(props: AO_REGION_RecordProps) {
    Object.assign(this, props);
  }
  validate(): void {
    /// TODO: implement this schema validation
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toInsertableArray(): any[] {
    return [this.REGION_ID, this.REGION_NAME];
  }
}
export function toAoRegionInsertStatements(records: Array<AO_REGION_Record>): string[] {
  return toSqlInsertStatements(AO_REGION_TableName, AO_REGION_InsertableColumnNames, records);
}
