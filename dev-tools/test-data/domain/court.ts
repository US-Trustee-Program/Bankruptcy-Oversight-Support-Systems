import { DatabaseRecords, emptyDatabaseRecords } from '../tables/common';

export interface Court {
  county: string;
  div: string;
  group: Group;
  id: string;
}

export interface Group {
  id: string;
  region: Region;
}

export interface Region {
  id: string;
  name: string;
}

export function toDbRecords(input: Array<Court> | Court): DatabaseRecords {
  const dbRecords = emptyDatabaseRecords();
  const courts = input instanceof Array ? input : [input];
  // TODO: Implement
  console.log(courts);
  return dbRecords;
}
