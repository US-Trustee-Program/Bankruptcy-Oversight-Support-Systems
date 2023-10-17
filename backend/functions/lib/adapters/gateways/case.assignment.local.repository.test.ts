import { CaseAttorneyAssignment } from '../types/case.attorney.assignment';
import { CaseAssignmentRepositoryInterface } from '../../interfaces/case.assignment.repository.interface';
import { CaseAssignmentLocalRepository } from './case.assignment.local.repository';
import { applicationContextCreator } from '../utils/application-context-creator';
const context = require('azure-function-context-mock');

describe('Case Assignment Repository Tests', () => {
  test('Should persist case assignment', async () => {
    const appContext = await applicationContextCreator(context);
    const caseId = '123';
    const testCaseAttorneyAssignment = new CaseAttorneyAssignment(
      caseId,
      'Susan Arbeit',
      'TrialAttorney',
    );
    const testCaseAssignmentLocalRepository: CaseAssignmentRepositoryInterface =
      new CaseAssignmentLocalRepository(appContext);

    await testCaseAssignmentLocalRepository.createAssignment(testCaseAttorneyAssignment);
    const actual = await testCaseAssignmentLocalRepository.findAssignmentsByCaseId(caseId);
    expect(actual[0]).toEqual(testCaseAttorneyAssignment);
  });
});
