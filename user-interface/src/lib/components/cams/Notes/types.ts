import { CamsUserReference } from '@common/cams/users';

export interface Note {
  id?: string;
  entityId: string;
  title: string;
  content: string;
  updatedBy: CamsUserReference;
  updatedOn: string;
  createdBy: CamsUserReference;
  createdOn: string;
  previousVersionId?: string;
  archivedOn?: string;
  archivedBy?: CamsUserReference;
}

export interface NoteInput {
  id?: string;
  entityId: string;
  title: string;
  content: string;
  updatedBy?: CamsUserReference;
  updatedOn?: string;
  createdBy?: CamsUserReference;
  createdOn?: string;
}
