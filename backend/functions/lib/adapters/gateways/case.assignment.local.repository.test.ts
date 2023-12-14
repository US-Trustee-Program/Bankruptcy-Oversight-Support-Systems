import { CaseAssignmentRepositoryInterface } from '../../interfaces/case.assignment.repository.interface';
import { CaseAssignmentLocalRepository } from './case.assignment.local.repository';
import { applicationContextCreator } from '../utils/application-context-creator';
import { CaseAssignmentRole } from '../types/case.assignment.role';
const context = require('azure-function-context-mock');

describe('Case Assignment Repository Tests', () => {
  test('Should persist case assignment', async () => {
    const applicationContext = await applicationContextCreator(context);
    const caseId = '123';
    const currentDate = new Date().toISOString();
    const testCaseAttorneyAssignment = {
      caseId,
      name: 'Susan Arbeit',
      role: CaseAssignmentRole['TrialAttorney'],
      assignedOn: currentDate,
    };
    const testCaseAssignmentLocalRepository: CaseAssignmentRepositoryInterface =
      new CaseAssignmentLocalRepository(applicationContext);

    await testCaseAssignmentLocalRepository.createAssignment(testCaseAttorneyAssignment);
    const actual = await testCaseAssignmentLocalRepository.findAssignmentsByCaseId(caseId);
    expect(actual[0]).toEqual(testCaseAttorneyAssignment);
  });
});
