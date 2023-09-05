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
      ['Jane'],
      CaseAssignmentRole.TrialAttorney,
    );

    const caseAssignmentLocalRepository: CaseAssignmentRepositoryInterface =
      new CaseAssignmentLocalRepository(context);

    let assignmentResponse: AttorneyAssignmentResponseInterface;
    try {
      const assignmentController = new CaseAssignmentController(
        context,
        caseAssignmentLocalRepository,
      );
      assignmentResponse =
        await assignmentController.createTrialAttorneyAssignments(testCaseAssignment);
    } catch (exception) {
      // exception.message;
    }
    const resultAssignmentId = assignmentResponse.body[0];

    const assignmentCreated = await caseAssignmentLocalRepository.getAssignment(resultAssignmentId);

    expect(resultAssignmentId).toBeTruthy();
    expect(assignmentCreated.caseId).toBe(testCaseAssignment.caseId);
    expect(assignmentCreated.attorneyName).toBe(testCaseAssignment.listOfAttorneyNames[0]);
    expect(assignmentCreated.role).toBe(testCaseAssignment.role);
  });

  test('avoid creation of duplicate assignment and return the Id of an existing assignment, if one already exists in the repository for the case', async () => {
    const caseAssignmentLocalRepository: CaseAssignmentRepositoryInterface =
      new CaseAssignmentLocalRepository(context);

    const testCaseAssignment = new TrialAttorneysAssignmentRequest(
      '12345',
      ['Jane'],
      CaseAssignmentRole.TrialAttorney,
    );
    let resultAssignmentId1: string;
    let resultAssignmentId2: string;

    try {
      const assignmentController = new CaseAssignmentController(
        context,
        caseAssignmentLocalRepository,
      );
      const assignmentResponse1 =
        await assignmentController.createTrialAttorneyAssignments(testCaseAssignment);
      const assignmentResponse2 =
        await assignmentController.createTrialAttorneyAssignments(testCaseAssignment);
      resultAssignmentId1 = assignmentResponse1.body[0];
      resultAssignmentId2 = assignmentResponse2.body[0];
    } catch (exception) {
      // exception.message;
    }

    const assignmentCreated1 =
      await caseAssignmentLocalRepository.getAssignment(resultAssignmentId1);
    const assignmentCreated2 =
      await caseAssignmentLocalRepository.getAssignment(resultAssignmentId2);
    expect(resultAssignmentId2).toBe(resultAssignmentId1);
    expect(assignmentCreated2).toEqual(assignmentCreated1);
    expect(context.res.status).toBe(200);
  });

  test('creating a new trial attorney assignment on a case with an existing assignment throws error', async () => {
    const caseAssignmentLocalRepository: CaseAssignmentRepositoryInterface =
      new CaseAssignmentLocalRepository(context);

    const testCaseAssignment1 = new TrialAttorneysAssignmentRequest(
      '12345',
      ['Jane'],
      CaseAssignmentRole.TrialAttorney,
    );

    const testCaseAssignment2 = new TrialAttorneysAssignmentRequest(
      '12345',
      ['John', 'Jane'],
      CaseAssignmentRole.TrialAttorney,
    );
    const assignmentController = new CaseAssignmentController(
      context,
      caseAssignmentLocalRepository,
    );

    const assignmentResponse1 =
      await assignmentController.createTrialAttorneyAssignments(testCaseAssignment1);

    const resultAssignmentId1 = assignmentResponse1.body[0];
    const assignmentCreated1 =
      await caseAssignmentLocalRepository.getAssignment(resultAssignmentId1);

    await expect(
      assignmentController.createTrialAttorneyAssignments(testCaseAssignment2),
    ).rejects.toThrow(AssignmentException);

    const expectedNumberOfAssignments: number = 1;
    const actualNumberOfAssignments = await caseAssignmentLocalRepository.getCount();
    expect(actualNumberOfAssignments).toBe(expectedNumberOfAssignments);
    expect(assignmentCreated1.caseId).toBe(testCaseAssignment1.caseId);
    expect(assignmentCreated1.attorneyName).toBe(testCaseAssignment1.listOfAttorneyNames[0]);
    expect(assignmentCreated1.role).toBe(testCaseAssignment1.role);
  });

  test('A chapter 15 case is assigned to the list of trial attorneys provided.', async () => {
    const testCaseAssignment = new TrialAttorneysAssignmentRequest(
      '12345',
      ['Jane', 'Tom', 'Adrian'],
      CaseAssignmentRole.TrialAttorney,
    );
    const caseAssignmentLocalRepository: CaseAssignmentRepositoryInterface =
      new CaseAssignmentLocalRepository(context);

    let assignmentResponse: AttorneyAssignmentResponseInterface;
    try {
      const assignmentController = new CaseAssignmentController(
        context,
        caseAssignmentLocalRepository,
      );
      assignmentResponse =
        await assignmentController.createTrialAttorneyAssignments(testCaseAssignment);
    } catch (exception) {
      // exception.message;
    }

    expect(assignmentResponse.body.length).toBe(testCaseAssignment.listOfAttorneyNames.length);

    const resultAssignmentId1 = assignmentResponse.body[0];
    const assignmentCreated1 =
      await caseAssignmentLocalRepository.getAssignment(resultAssignmentId1);

    expect(resultAssignmentId1).toBeTruthy();
    expect(assignmentCreated1.caseId).toBe(testCaseAssignment.caseId);
    expect(assignmentCreated1.attorneyName).toBe(testCaseAssignment.listOfAttorneyNames[0]);
    expect(assignmentCreated1.role).toBe(testCaseAssignment.role);

    const resultAssignmentId2 = assignmentResponse.body[1];
    const assignmentCreated2 =
      await caseAssignmentLocalRepository.getAssignment(resultAssignmentId2);

    expect(resultAssignmentId2).toBeTruthy();
    expect(assignmentCreated2.caseId).toBe(testCaseAssignment.caseId);
    expect(assignmentCreated2.attorneyName).toBe(testCaseAssignment.listOfAttorneyNames[1]);
    expect(assignmentCreated2.role).toBe(testCaseAssignment.role);

    const resultAssignmentId3 = assignmentResponse.body[2];
    const assignmentCreated3 =
      await caseAssignmentLocalRepository.getAssignment(resultAssignmentId3);

    expect(resultAssignmentId3).toBeTruthy();
    expect(assignmentCreated3.caseId).toBe(testCaseAssignment.caseId);
    expect(assignmentCreated3.attorneyName).toBe(testCaseAssignment.listOfAttorneyNames[2]);
    expect(assignmentCreated3.role).toBe(testCaseAssignment.role);
  });
});
