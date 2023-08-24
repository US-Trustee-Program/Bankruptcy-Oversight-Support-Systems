import { CaseAttorneyAssignment } from '../types/case.attorney.assignment';
import { CaseAssignmentRole } from '../types/case.assignment.role';
import { CaseAssignmentRepositoryInterface } from '../../interfaces/case.assignment.repository.interface';
import { CaseAssignmentLocalRepository } from './case.assignment.local.repository';

describe('Case Assignment Repository Tests', () => {
  test('Should persist case assignment', async () => {
    const testCaseAttorneyAssignment = new CaseAttorneyAssignment(
      '123',
      'Susan Arbeit',
      CaseAssignmentRole.TrialAttorney,
      'Drew kerrigan',
    );
    const testCaseAssignmentLocalRepository: CaseAssignmentRepositoryInterface =
      new CaseAssignmentLocalRepository();

    console.log(testCaseAttorneyAssignment);
    console.log(testCaseAssignmentLocalRepository);
  });
});
