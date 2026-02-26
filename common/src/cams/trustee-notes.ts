import { Auditable } from './auditable';
import { CamsUserReference } from './users';

export type TrusteeNote = TrusteeNoteInput &
  Auditable & {
    documentType: 'TRUSTEE_NOTE';
    updatedBy: CamsUserReference;
    updatedOn: string;
    createdBy: CamsUserReference;
    createdOn: string;
    archivedOn?: string;
    archivedBy?: CamsUserReference;
    previousVersionId?: string;
  };

export type TrusteeNoteDeleteRequest = {
  id: string;
  trusteeId: string;
  sessionUser: CamsUserReference;
};

export type TrusteeNoteEditRequest = {
  note: Partial<TrusteeNote>;
  sessionUser: CamsUserReference;
};

export type TrusteeNoteInput = {
  id?: string;
  title: string;
  trusteeId: string;
  content: string;
  updatedBy?: CamsUserReference;
  updatedOn?: string;
  createdBy?: CamsUserReference;
  createdOn?: string;
};
