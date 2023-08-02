import { CaseAssignmentRequest } from '../adapters/types/case.assignment.request';
import { CaseAssignmentRole } from '../adapters/types/case.assignment.role';
import { CaseAssignmentController } from '../adapters/controllers/case.assignment.controller';
import { ICaseAssignmentRepository } from '../interfaces/ICaseAssignmentRepository';
import { CaseAssignmentLocalRepository } from '../adapters/gateways/case.assignment.local.repository';
const context = require('azure-function-context-mock');
describe('Chapter 15 Case Assignment Tests', () => {
  test('A chapter 15 case is assigned to an attorney when requested', async () => {
    const testCaseAssignment = new CaseAssignmentRequest(
      '12345',
      '8082',
      CaseAssignmentRole.TrialAttorney,
    );

    let result: number;
    const mockCaseAssignmentRepository: ICaseAssignmentRepository =
      new CaseAssignmentLocalRepository();
    try {
      const assignmentController = new CaseAssignmentController(
        context,
        mockCaseAssignmentRepository,
      );
      result = await assignmentController.createCaseAssignment(testCaseAssignment);
    } catch (exception) {
      // exception.message;
    }
    //TO DO create and check via the get call on the repository.
    const assignmentCreated = mockCaseAssignmentRepository.getAssignment(result);

    expect(result).toBeGreaterThan(0);
    expect(assignmentCreated._caseId).toBe(testCaseAssignment.caseId);
    expect(assignmentCreated._professionalId).toBe(testCaseAssignment.professionalId);
    expect(assignmentCreated._role).toBe(testCaseAssignment.role);
  });
});
