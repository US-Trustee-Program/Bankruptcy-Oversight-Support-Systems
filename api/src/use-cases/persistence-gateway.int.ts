import { RecordObj, DbRecord } from '../adapters/types/basic';

export type PersistenceGateway = {
  createRecord(table: string, fields: RecordObj[]): boolean;
  getAll(table: string): DbRecord;
  getRecord(table: string, id: number): DbRecord;
  updateRecord(table: string, fields: RecordObj[]): boolean;
  deleteRecord(table: string, id: number): boolean;
}
