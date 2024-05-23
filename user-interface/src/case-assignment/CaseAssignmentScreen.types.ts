import { CaseBasics } from '@common/cams/cases';

// TODO: Maybe this is a derivative we should put into common, or just include optional assignments with the CaseBasics.
export type CaseWithAssignments = CaseBasics & {
  assignments?: string[];
};
