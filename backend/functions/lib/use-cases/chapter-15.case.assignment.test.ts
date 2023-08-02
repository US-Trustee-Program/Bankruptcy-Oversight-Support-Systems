import { CaseAssignmentRequest } from '../adapters/types/case.assignment.request';
import { CaseAssignmentRole } from '../adapters/types/case.assignment.role';
import { CaseAssignmentController } from '../adapters/controllers/case.assignment.controller';
const context = require('azure-function-context-mock');
describe('Chapter 15 Case Assignment Tests', () => {
  test('A chapter 15 case is assigned to an attorney when requested', async () => {
    const testCaseAssignment = new CaseAssignmentRequest(
      '12345',
      '8082',
      CaseAssignmentRole.TrialAttorney,
    );

    let result: number;
    try {
      const assignmentController = new CaseAssignmentController(context);
      result = await assignmentController.createCaseAssignment(testCaseAssignment);
    } catch (exception) {
      // exception.message;
    }
    //TO DO create and check via the get call on the repository.
    expect(result).toBeGreaterThan(0);
  });
});
