import { CaseAssignmentRole } from '../types/case.assignment.role';
import { CaseAssignmentController } from './case.assignment.controller';
import { CaseAssignmentRepositoryInterface } from '../../interfaces/case.assignment.repository.interface';
import { CaseAssignmentLocalRepository } from '../gateways/case.assignment.local.repository';
import { TrialAttorneysAssignmentRequest } from '../types/trial.attorneys.assignment.request';
import { AttorneyAssignmentResponseInterface } from '../types/case.assignment';
import { AssignmentException } from '../../use-cases/assignment.exception';
const context = require('azure-function-context-mock');
describe('Chapter 15 Case Assignment Creation Tests', () => {
  test('A chapter 15 case is assigned to an attorney when requested', async () => {
    const testCaseAssignment = new TrialAttorneysAssignmentRequest(
      '12345',
      ['8082'],
      CaseAssignmentRole.TrialAttorney,
    );

    const caseAssignmentLocalRepository: CaseAssignmentRepositoryInterface =
      new CaseAssignmentLocalRepository();

    let assignmentResponse: AttorneyAssignmentResponseInterface;
    try {
      const assignmentController = new CaseAssignmentController(
        context,
        caseAssignmentLocalRepository,
      );
      assignmentResponse = await assignmentController.createTrailAttorneyAssignments(
        testCaseAssignment,
      );
    } catch (exception) {
      // exception.message;
    }
    const resultAssignmentId = assignmentResponse.body[0];

    const assignmentCreated = await caseAssignmentLocalRepository.getAssignment(resultAssignmentId);

    expect(resultAssignmentId).toBeTruthy();
    expect(assignmentCreated.caseId).toBe(testCaseAssignment.caseId);
    expect(assignmentCreated.attorneyId).toBe(testCaseAssignment.listOfAttorneyIds[0]);
    expect(assignmentCreated.role).toBe(testCaseAssignment.role);
  });

  test('avoid creation of duplicate assignment and return the Id of an existing assignment, if one already exists in the repository for the case', async () => {
    const caseAssignmentLocalRepository: CaseAssignmentRepositoryInterface =
      new CaseAssignmentLocalRepository();

    const testCaseAssignment = new TrialAttorneysAssignmentRequest(
      '12345',
      ['8082'],
      CaseAssignmentRole.TrialAttorney,
    );
    let resultAssignmentId1: number;
    let resultAssignmentId2: number;

    try {
      const assignmentController = new CaseAssignmentController(
        context,
        caseAssignmentLocalRepository,
      );
      const assignmentResponse1 = await assignmentController.createTrailAttorneyAssignments(
        testCaseAssignment,
      );
      const assignmentResponse2 = await assignmentController.createTrailAttorneyAssignments(
        testCaseAssignment,
      );
      resultAssignmentId1 = assignmentResponse1.body[0];
      resultAssignmentId2 = assignmentResponse2.body[0];
    } catch (exception) {
      // exception.message;
    }

    const assignmentCreated1 = await caseAssignmentLocalRepository.getAssignment(
      resultAssignmentId1,
    );
    const assignmentCreated2 = await caseAssignmentLocalRepository.getAssignment(
      resultAssignmentId2,
    );
    expect(resultAssignmentId2).toBe(resultAssignmentId1);
    expect(assignmentCreated2).toEqual(assignmentCreated1);
    expect(context.res.status).toBe(200);
  });

  test('creating a new trial attorney assignment on a case with an existing assignment throws error', async () => {
    const caseAssignmentLocalRepository: CaseAssignmentRepositoryInterface =
      new CaseAssignmentLocalRepository();

    const testCaseAssignment1 = new TrialAttorneysAssignmentRequest(
      '12345',
      ['8082'],
      CaseAssignmentRole.TrialAttorney,
    );

    const testCaseAssignment2 = new TrialAttorneysAssignmentRequest(
      '12345',
      ['8083'],
      CaseAssignmentRole.TrialAttorney,
    );
    const assignmentController = new CaseAssignmentController(
      context,
      caseAssignmentLocalRepository,
    );

    const assignmentResponse1 = await assignmentController.createTrailAttorneyAssignments(
      testCaseAssignment1,
    );

    const resultAssignmentId1 = assignmentResponse1.body[0];
    const assignmentCreated1 = await caseAssignmentLocalRepository.getAssignment(
      resultAssignmentId1,
    );

    await expect(
      assignmentController.createTrailAttorneyAssignments(testCaseAssignment2),
    ).rejects.toThrow(AssignmentException);

    const expectedNumberOfAssignments: number = 1;
    const actualNumberOfAssignments = await caseAssignmentLocalRepository.getCount();
    expect(actualNumberOfAssignments).toBe(expectedNumberOfAssignments);
    expect(assignmentCreated1.caseId).toBe(testCaseAssignment1.caseId);
    expect(assignmentCreated1.attorneyId).toBe(testCaseAssignment1.listOfAttorneyIds[0]);
    expect(assignmentCreated1.role).toBe(testCaseAssignment1.role);
  });

  test('A chapter 15 case is assigned to the list of trial attorneys provided.', async () => {
    const testCaseAssignment = new TrialAttorneysAssignmentRequest(
      '12345',
      ['8082', '8092', '8094'],
      CaseAssignmentRole.TrialAttorney,
    );
    const caseAssignmentLocalRepository: CaseAssignmentRepositoryInterface =
      new CaseAssignmentLocalRepository();

    let assignmentResponse: AttorneyAssignmentResponseInterface;
    try {
      const assignmentController = new CaseAssignmentController(
        context,
        caseAssignmentLocalRepository,
      );
      assignmentResponse = await assignmentController.createTrailAttorneyAssignments(
        testCaseAssignment,
      );
    } catch (exception) {
      // exception.message;
    }

    expect(assignmentResponse.body.length).toBe(testCaseAssignment.listOfAttorneyIds.length);

    const resultAssignmentId1 = assignmentResponse.body[0];
    const assignmentCreated1 = await caseAssignmentLocalRepository.getAssignment(
      resultAssignmentId1,
    );

    expect(resultAssignmentId1).toBeTruthy();
    expect(assignmentCreated1.caseId).toBe(testCaseAssignment.caseId);
    expect(assignmentCreated1.attorneyId).toBe(testCaseAssignment.listOfAttorneyIds[0]);
    expect(assignmentCreated1.role).toBe(testCaseAssignment.role);

    const resultAssignmentId2 = assignmentResponse.body[1];
    const assignmentCreated2 = await caseAssignmentLocalRepository.getAssignment(
      resultAssignmentId2,
    );

    expect(resultAssignmentId2).toBeTruthy();
    expect(assignmentCreated2.caseId).toBe(testCaseAssignment.caseId);
    expect(assignmentCreated2.attorneyId).toBe(testCaseAssignment.listOfAttorneyIds[1]);
    expect(assignmentCreated2.role).toBe(testCaseAssignment.role);

    const resultAssignmentId3 = assignmentResponse.body[2];
    const assignmentCreated3 = await caseAssignmentLocalRepository.getAssignment(
      resultAssignmentId3,
    );

    expect(resultAssignmentId3).toBeTruthy();
    expect(assignmentCreated3.caseId).toBe(testCaseAssignment.caseId);
    expect(assignmentCreated3.attorneyId).toBe(testCaseAssignment.listOfAttorneyIds[2]);
    expect(assignmentCreated3.role).toBe(testCaseAssignment.role);
  });
});
