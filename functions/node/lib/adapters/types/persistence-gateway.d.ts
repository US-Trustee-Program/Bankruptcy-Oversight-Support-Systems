import { RecordObj, ObjectKeyVal } from './basic';
import { DbResult } from './database';
import { Context } from './basic';
import { CaseListDbResult } from './cases';

export type PersistenceGateway = {
  createRecord(context: Context, table: string, fields: RecordObj[]): Promise<DbResult>;
  getAll(context: Context, table: string): Promise<DbResult>;
  getRecord(context: Context, table: string, id: number): Promise<DbResult>;
  updateRecord(context: Context, table: string, id: number, fields: RecordObj[]): Promise<DbResult>;
  deleteRecord(context: Context, table: string, id: number): Promise<DbResult>;
};

export type CasePersistenceGateway = {
  createCase(context: Context, fields: RecordObj[]): Promise<DbResult>;
  getCaseList(context: Context, fields: ObjectKeyVal): Promise<CaseListDbResult>;
  getCase(context: Context, id: number): Promise<DbResult>;
  updateCase(context: Context, id: number, fields: RecordObj[]): Promise<DbResult>;
  deleteCase(context: Context, id: number): Promise<DbResult>;
};

type UserNameType = { firstName: string, lastName: string };

export type UserPersistenceGateway = {
  login(context: Context, name: UserNameType): Promise<DbResult>;
};

export type ChaptersPersistenceGateway = {
  getChaptersList(): Promise<DbResult>;
};
