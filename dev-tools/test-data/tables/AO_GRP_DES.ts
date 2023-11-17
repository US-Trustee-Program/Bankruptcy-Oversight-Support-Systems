import { ColumnNames, TableRecordHelper } from '../types';
import { toSqlInsertStatements } from '../utility';

/*
use AODATEX_SUB
go

create table dbo.AO_GRP_DES
(
    GRP_DES   varchar(2) not null collate SQL_Latin1_General_CP1_CI_AS
        constraint XPKAO_GRP_DES
            primary key,
    REGION_ID varchar(2) collate SQL_Latin1_General_CP1_CI_AS
        constraint RAO_REGION_GRP_DES
            references dbo.AO_REGION
)
go

create index XIF1AO_GRP_DES
    on dbo.AO_GRP_DES (REGION_ID)
go
*/

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
