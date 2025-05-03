import { AttorneyUser } from '../../../../common/src/cams/users';
import { ObjectKeyVal, RecordObj } from './basic';
import { ApplicationContext } from './basic';
import { DbResult } from './database';

export interface AttorneyPersistenceGateway {
  getAttorneyList(
    applicationContext: ApplicationContext,
    fields: ObjectKeyVal,
  ): Promise<AttorneyUser[]>;
}

export interface CasePersistenceGateway {
  createCase(applicationContext: ApplicationContext, fields: RecordObj[]): Promise<DbResult>;
  deleteCase(applicationContext: ApplicationContext, id: number): Promise<DbResult>;
  getCase(applicationContext: ApplicationContext, id: number): Promise<DbResult>;
  updateCase(
    applicationContext: ApplicationContext,
    id: number,
    fields: RecordObj[],
  ): Promise<DbResult>;
}

export interface ChaptersPersistenceGateway {
  getChaptersList(): Promise<DbResult>;
}

export interface PersistenceGateway {
  createRecord(
    applicationContext: ApplicationContext,
    table: string,
    fields: RecordObj[],
  ): Promise<DbResult>;
  deleteRecord(
    applicationContext: ApplicationContext,
    table: string,
    id: number,
  ): Promise<DbResult>;
  getAll(applicationContext: ApplicationContext, table: string): Promise<DbResult>;
  getRecord(applicationContext: ApplicationContext, table: string, id: number): Promise<DbResult>;
  updateRecord(
    applicationContext: ApplicationContext,
    table: string,
    id: number,
    fields: RecordObj[],
  ): Promise<DbResult>;
}
