import { RecordObj, ObjectKeyVal } from './basic';
import { DbResult } from './database';
import { ApplicationContext } from './basic';
import { CaseListDbResult } from './cases';
import { AttorneyListDbResult } from './attorneys';

export type PersistenceGateway = {
  createRecord(context: ApplicationContext, table: string, fields: RecordObj[]): Promise<DbResult>;
  getAll(context: ApplicationContext, table: string): Promise<DbResult>;
  getRecord(context: ApplicationContext, table: string, id: number): Promise<DbResult>;
  updateRecord(
    context: ApplicationContext,
    table: string,
    id: number,
    fields: RecordObj[],
  ): Promise<DbResult>;
  deleteRecord(context: ApplicationContext, table: string, id: number): Promise<DbResult>;
};

export type CasePersistenceGateway = {
  createCase(context: ApplicationContext, fields: RecordObj[]): Promise<DbResult>;
  getCaseList(context: ApplicationContext, fields: ObjectKeyVal): Promise<CaseListDbResult>;
  getCase(context: ApplicationContext, id: number): Promise<DbResult>;
  updateCase(context: ApplicationContext, id: number, fields: RecordObj[]): Promise<DbResult>;
  deleteCase(context: ApplicationContext, id: number): Promise<DbResult>;
};

export interface AttorneyPersistenceGateway {
  getAttorneyList(context: ApplicationContext, fields: ObjectKeyVal): Promise<AttorneyListDbResult>;
}

type UserNameType = { firstName: string; lastName: string };

export type UserPersistenceGateway = {
  login(context: ApplicationContext, name: UserNameType): Promise<DbResult>;
};

export type ChaptersPersistenceGateway = {
  getChaptersList(): Promise<DbResult>;
};
