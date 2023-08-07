import { CaseAssignmentRequest } from '../adapters/types/case.assignment.request';
import { CaseAssignmentRole } from '../adapters/types/case.assignment.role';
import { CaseAssignmentController } from '../adapters/controllers/case.assignment.controller';
import { ICaseAssignmentRepository } from '../interfaces/ICaseAssignmentRepository';
import { CaseAssignmentLocalRepository } from '../adapters/gateways/case.assignment.local.repository';
import { TrialAttorneyAssignmentResponse } from '../adapters/types/trial.attorney.assignment.response';
import { TrialAttorneysAssignmentRequest } from '../adapters/types/trial.attorneys.assignment.request';
const context = require('azure-function-context-mock');
describe('Chapter 15 Case Assignment Creation Tests', () => {
  test('A chapter 15 case is assigned to an attorney when requested', async () => {
    const testCaseAssignment = new CaseAssignmentRequest(
      '12345',
      CaseAssignmentRole.TrialAttorney,
      '8082',
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
      CaseAssignmentRole.TrialAttorney,
      '8082',
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
      CaseAssignmentRole.TrialAttorney,
      '8082',
    );

    let resultAssignmentId1: number;

    const testCaseAssignment2 = new CaseAssignmentRequest(
      '12345',
      CaseAssignmentRole.TrialAttorney,
      '8083',
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

  test('A chapter 15 case is assigned to the list of trial attorneys provided.', async () => {
    //given a case assignmentRequest with caseId, Attorney[], role
    const testCaseAssignment = new TrialAttorneysAssignmentRequest(
      '12345',
      ['8082', '8092', '8094'],
      CaseAssignmentRole.TrialAttorney,
    );
    const mockCaseAssignmentRepository: ICaseAssignmentRepository =
      new CaseAssignmentLocalRepository();

    //When requested for assignment
    //Then assignments created and a list of the assignmentIds are returned.
    let assignmentResponse: TrialAttorneyAssignmentResponse;
    try {
      const assignmentController = new CaseAssignmentController(
        context,
        mockCaseAssignmentRepository,
      );
      assignmentResponse = await assignmentController.createTrailAttorneyAssignments(
        testCaseAssignment,
      );
    } catch (exception) {
      // exception.message;
    }

    expect(assignmentResponse.assignmentIdList.length).toBe(
      testCaseAssignment.listOfAttorneyIds.length,
    );
  });
});
