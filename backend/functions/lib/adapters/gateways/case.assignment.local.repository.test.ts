import { CaseAttorneyAssignment } from '../types/case.attorney.assignment';
import { CaseAssignmentRole } from '../types/case.assignment.role';
import { CaseAssignmentRepositoryInterface } from '../../interfaces/case.assignment.repository.interface';
import { CaseAssignmentLocalRepository } from './case.assignment.local.repository';
import { applicationContextCreator } from '../utils/application-context-creator';
const context = require('azure-function-context-mock');

const appContext = applicationContextCreator(context);
describe('Case Assignment Repository Tests', () => {
  test('Should persist case assignment', async () => {
    const testCaseAttorneyAssignment = new CaseAttorneyAssignment(
      '123',
      'Susan Arbeit',
      CaseAssignmentRole.TrialAttorney,
    );
    const testCaseAssignmentLocalRepository: CaseAssignmentRepositoryInterface =
      new CaseAssignmentLocalRepository(appContext);

    await testCaseAssignmentLocalRepository.createAssignment(testCaseAttorneyAssignment);
    const actual = await testCaseAssignmentLocalRepository.findAssignment(
      testCaseAttorneyAssignment,
    );
    expect(actual).toEqual(testCaseAttorneyAssignment);
  });

  test('should not create a duplicate assignment', async () => {
    const testCaseAttorneyAssignment = new CaseAttorneyAssignment(
      '123',
      'Susan Arbeit',
      CaseAssignmentRole.TrialAttorney,
    );
    const testCaseAssignmentLocalRepository: CaseAssignmentRepositoryInterface =
      new CaseAssignmentLocalRepository(appContext);

    const firstId = await testCaseAssignmentLocalRepository.createAssignment(
      testCaseAttorneyAssignment,
    );
    const first = await testCaseAssignmentLocalRepository.findAssignment(
      testCaseAttorneyAssignment,
    );
    expect(first).toEqual(testCaseAttorneyAssignment);
    const secondId = await testCaseAssignmentLocalRepository.createAssignment(
      testCaseAttorneyAssignment,
    );
    expect(firstId).toEqual(secondId);
  });
});
