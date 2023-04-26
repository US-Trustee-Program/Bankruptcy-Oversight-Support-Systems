import { RecordObj, ObjectKeyVal } from './basic';
import { DbResult } from './database';
import { LogContext } from '../types/basic.d';

export type PersistenceGateway = {
  createRecord(table: string, fields: RecordObj[]): Promise<DbResult>;
  getAll(table: string): Promise<DbResult>;
  getRecord(table: string, id: number): Promise<DbResult>;
  updateRecord(table: string, id: number, fields: RecordObj[]): Promise<DbResult>;
  deleteRecord(table: string, id: number): Promise<DbResult>;
};

export type CasePersistenceGateway = {
  createCase(fields: RecordObj[]): Promise<DbResult>;
  getCaseList(fields: ObjectKeyVal): Promise<DbResult>;
  getCase(id: number): Promise<DbResult>;
  updateCase(id: number, fields: RecordObj[]): Promise<DbResult>;
  deleteCase(id: number): Promise<DbResult>;
};

type UserNameType = { firstName: string, lastName: string };

export type UserPersistenceGateway = {
  login(context: LogContext, name: UserNameType): Promise<DbResult>;
};

export type ChaptersPersistenceGateway = {
  getChaptersList(): Promise<DbResult>;
};
