import { CaseAttorneyAssignment } from './case.attorney.assignment';

export interface AttorneyAssignmentResponseInterface {
  success: boolean;
  message: string;
  count: number;
  body: string[] | CaseAttorneyAssignment[];
}
