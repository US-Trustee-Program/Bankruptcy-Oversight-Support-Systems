import { CaseAssignmentRequest } from '../adapters/types/case.assignment.request';
import { CaseAssignmentResponse, CaseAssignmentRole } from '../adapters/types/case.assignment';
import { AssignmentController } from '../adapters/controllers/assignment.controller';
const context = require('azure-function-context-mock');
describe('Chapter 15 Case Assignment Tests', () => {
  test('A chapter 15 case is assigned to an attorney when requested', async () => {
    const testCaseAssignment = new CaseAssignmentRequest(
      '12345',
      '8082',
      CaseAssignmentRole.TrialAttorney,
    );

    let result: CaseAssignmentResponse;
    try {
      const assignmentController = new AssignmentController(context);
      result = await assignmentController.createCaseAssignment(testCaseAssignment);
    } catch (exception) {
      result.message = exception.message;
    }

    expect(result).toBeTruthy();
    expect(result.success).toBeTruthy();
  });
});
