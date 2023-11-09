import { DatabaseRecords, emptyDatabaseRecords } from '../tables/common';

export interface Region {
  id: string;
  name: string;
}

export interface Group {
  id: string;
  region: Region;
}

export interface Court {
  id: string;
  group: Group;
  county: string;
  div: string;
}

export function toDbRecords(input: Court | Array<Court>): DatabaseRecords {
  const dbRecords = emptyDatabaseRecords();
  const courts = input instanceof Array ? input : [input];
  // TODO: Implement
  console.log(courts);
  return dbRecords;
}
