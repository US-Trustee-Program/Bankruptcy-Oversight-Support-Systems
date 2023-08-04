import { CaseAssignmentRequest } from '../adapters/types/case.assignment.request';
import { CaseAssignmentRole } from '../adapters/types/case.assignment.role';
import { CaseAssignmentController } from '../adapters/controllers/case.assignment.controller';
import { ICaseAssignmentRepository } from '../interfaces/ICaseAssignmentRepository';
import { CaseAssignmentLocalRepository } from '../adapters/gateways/case.assignment.local.repository';
const context = require('azure-function-context-mock');
describe('Chapter 15 Case Assignment Creation Tests', () => {
  test('A chapter 15 case is assigned to an attorney when requested', async () => {
    const testCaseAssignment = new CaseAssignmentRequest(
      '12345',
      '8082',
      CaseAssignmentRole.TrialAttorney,
    );

    let resultAssignmentId: number;
    const mockCaseAssignmentRepository: ICaseAssignmentRepository =
      new CaseAssignmentLocalRepository();
    try {
      const assignmentController = new CaseAssignmentController(
        context,
        mockCaseAssignmentRepository,
      );
      resultAssignmentId = await assignmentController.createCaseAssignment(testCaseAssignment);
    } catch (exception) {
      // exception.message;
    }

    const assignmentCreated = await mockCaseAssignmentRepository.getAssignment(resultAssignmentId);

    expect(resultAssignmentId).toBeGreaterThan(0);
    expect(assignmentCreated._caseId).toBe(testCaseAssignment.caseId);
    expect(assignmentCreated._professionalId).toBe(testCaseAssignment.professionalId);
    expect(assignmentCreated._role).toBe(testCaseAssignment.role);
  });

  test('avoid creation of duplicate assignment and return the Id of an existing assignment, if one already exists in the repository for the case', async () => {
    const mockCaseAssignmentRepository: ICaseAssignmentRepository =
      new CaseAssignmentLocalRepository();

    const testCaseAssignment1 = new CaseAssignmentRequest(
      '12345',
      '8082',
      CaseAssignmentRole.TrialAttorney,
    );

    let resultAssignmentId1: number;
    let resultAssignmentId2: number;

    try {
      const assignmentController = new CaseAssignmentController(
        context,
        mockCaseAssignmentRepository,
      );
      resultAssignmentId1 = await assignmentController.createCaseAssignment(testCaseAssignment1);
      resultAssignmentId2 = await assignmentController.createCaseAssignment(testCaseAssignment1);
    } catch (exception) {
      // exception.message;
    }

    const assignmentCreated1 = await mockCaseAssignmentRepository.getAssignment(
      resultAssignmentId1,
    );
    const assignmentCreated2 = await mockCaseAssignmentRepository.getAssignment(
      resultAssignmentId2,
    );
    expect(resultAssignmentId2).toBe(resultAssignmentId1);
    expect(assignmentCreated2).toEqual(assignmentCreated1);
  });

  test('create a new trial attorney assignment on an existing case succeeds', async () => {
    const mockCaseAssignmentRepository: ICaseAssignmentRepository =
      new CaseAssignmentLocalRepository();

    const testCaseAssignment1 = new CaseAssignmentRequest(
      '12345',
      '8082',
      CaseAssignmentRole.TrialAttorney,
    );

    let resultAssignmentId1: number;

    const testCaseAssignment2 = new CaseAssignmentRequest(
      '12345',
      '8083',
      CaseAssignmentRole.TrialAttorney,
    );
    let resultAssignmentId2: number;

    try {
      const assignmentController = new CaseAssignmentController(
        context,
        mockCaseAssignmentRepository,
      );
      resultAssignmentId1 = await assignmentController.createCaseAssignment(testCaseAssignment1);
      resultAssignmentId2 = await assignmentController.createCaseAssignment(testCaseAssignment2);
    } catch (exception) {
      // exception.message;
    }
    const assignmentCreated1 = await mockCaseAssignmentRepository.getAssignment(
      resultAssignmentId1,
    );
    const assignmentCreated2 = await mockCaseAssignmentRepository.getAssignment(
      resultAssignmentId2,
    );
    expect(resultAssignmentId2).not.toBe(resultAssignmentId1);
    expect(assignmentCreated2).not.toEqual(assignmentCreated1);

    const expectedNumberOfAssignments: number = 2;
    const actualNumberOfAssignments = await mockCaseAssignmentRepository.getCount();
    expect(actualNumberOfAssignments).toBe(expectedNumberOfAssignments);
  });
});
