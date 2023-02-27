import { RecordObj, DbRecord } from './basic';

export type PersistenceGateway = {
  createRecord(table: string, fields: RecordObj[]): Promise<boolean>;
  getAll(table: string): Promise<DbRecord>;
  getRecord(table: string, id: number): Promise<DbRecord>;
  updateRecord(table: string, id: number, fields: RecordObj[]): Promise<DbRecord>;
  deleteRecord(table: string, id: number): Promise<boolean>;
};
