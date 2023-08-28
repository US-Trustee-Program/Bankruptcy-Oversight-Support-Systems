import { CaseAttorneyAssignment } from '../types/case.attorney.assignment';
import { CaseAssignmentRole } from '../types/case.assignment.role';
import { CaseAssignmentCosmosDbRepository } from './case.assignment.cosmosdb.repository';
import { applicationContextCreator } from '../utils/application-context-creator';
const context = require('azure-function-context-mock');

const appContext = applicationContextCreator(context);
describe('Test case assignment cosmosdb repository tests', async () => {
  test('Should persist case assignment', async () => {
    const testCaseAttorneyAssignment: CaseAttorneyAssignment = new CaseAttorneyAssignment(
      '123',
      'Susan Arbeit',
      CaseAssignmentRole.TrialAttorney,
      'Drew kerrigan',
    );

    const testCaseAssignmentCosmosDbRepository: CaseAssignmentCosmosDbRepository =
      new CaseAssignmentCosmosDbRepository();

    await testCaseAssignmentCosmosDbRepository.createAssignment(
      appContext,
      testCaseAttorneyAssignment,
    );

    const actual = await testCaseAssignmentCosmosDbRepository.findAssignment(
      testCaseAttorneyAssignment,
    );

    expect(actual).toEqual(testCaseAttorneyAssignment);
  });
});
