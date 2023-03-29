import { RecordObj, DbResult } from './basic';

export type PersistenceGateway = {
  createRecord(table: string, fields: RecordObj[]): Promise<DbResult>;
  getAll(table: string): Promise<DbResult>;
  getRecord(table: string, id: number): Promise<DbResult>;
  updateRecord(table: string, id: number, fields: RecordObj[]): Promise<DbResult>;
  deleteRecord(table: string, id: number): Promise<DbResult>;
};

export type CasePersistenceGateway = {
  createCase(fields: RecordObj[]): Promise<DbResult>;
  getCaseList(chapterFilter: String): Promise<DbResult>;
  getCase(id: number): Promise<DbResult>;
  updateCase(id: number, fields: RecordObj[]): Promise<DbResult>;
  deleteCase(id: number): Promise<DbResult>;
};

export type ChaptersPersistenceGateway = {
  getChaptersList(): Promise<DbResult>;
};
