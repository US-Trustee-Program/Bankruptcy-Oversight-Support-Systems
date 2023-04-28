import { RecordObj, ObjectKeyVal } from './basic';
import { DbResult } from './database';
import { LogContext } from './basic';
import { CaseListDbResult } from './cases';

export type PersistenceGateway = {
  createRecord(context: LogContext, table: string, fields: RecordObj[]): Promise<DbResult>;
  getAll(context: LogContext, table: string): Promise<DbResult>;
  getRecord(context: LogContext, table: string, id: number): Promise<DbResult>;
  updateRecord(context: LogContext, table: string, id: number, fields: RecordObj[]): Promise<DbResult>;
  deleteRecord(context: LogContext, table: string, id: number): Promise<DbResult>;
};

export type CasePersistenceGateway = {
  createCase(context: LogContext, fields: RecordObj[]): Promise<DbResult>;
  getCaseList(context: LogContext, fields: ObjectKeyVal): Promise<CaseListDbResult>;
  getCase(context: LogContext, id: number): Promise<DbResult>;
  updateCase(context: LogContext, id: number, fields: RecordObj[]): Promise<DbResult>;
  deleteCase(context: LogContext, id: number): Promise<DbResult>;
};

type UserNameType = { firstName: string, lastName: string };

export type UserPersistenceGateway = {
  login(context: LogContext, name: UserNameType): Promise<DbResult>;
};

export type ChaptersPersistenceGateway = {
  getChaptersList(): Promise<DbResult>;
};
