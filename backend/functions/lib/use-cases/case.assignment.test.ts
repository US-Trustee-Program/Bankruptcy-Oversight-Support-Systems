import { ApplicationContext } from '../adapters/types/basic';
import { applicationContextCreator } from '../adapters/utils/application-context-creator';
import { CaseAssignmentUseCase } from './case.assignment';
import { CaseAssignmentRole } from '../adapters/types/case.assignment.role';

const functionContext = require('azure-function-context-mock');

const randomId = () => {
  return '' + Math.random() * 99999999;
};

const createAssignment = jest.fn().mockImplementation(randomId);
const updateAssignment = jest.fn().mockImplementation(randomId);
const findAssignmentsByCaseId = jest.fn();

jest.mock('../adapters/gateways/case.assignment.cosmosdb.repository', () => {
  return {
    CaseAssignmentCosmosDbRepository: jest.fn().mockImplementation(() => {
      return {
        createAssignment,
        findAssignmentsByCaseId,
        updateAssignment,
      };
    }),
  };
});

describe('Case assignment tests', () => {
  let applicationContext: ApplicationContext;
  beforeEach(async () => {
    applicationContext = await applicationContextCreator(functionContext);
    process.env = {
      STARTING_MONTH: '-6',
      DATABASE_MOCK: 'true',
    };
  });

  describe('findAssignmentsByCaseId', () => {
    test('should return all assignments for a given case ID', async () => {
      const caseId = '111-22-12345';
      const assignments = [
        {
          caseId: caseId,
          name: 'Joe',
          role: CaseAssignmentRole.TrialAttorney,
          assignedOn: new Date().toISOString(),
        },
        {
          caseId: caseId,
          name: 'Jane',
          role: CaseAssignmentRole.TrialAttorney,
          assignedOn: new Date().toISOString(),
        },
      ];
      findAssignmentsByCaseId.mockResolvedValue(assignments);

      const assignmentUseCase = new CaseAssignmentUseCase(applicationContext);

      const actualAssignments = await assignmentUseCase.findAssignmentsByCaseId(caseId);

      expect(actualAssignments.length).toEqual(2);
      expect(actualAssignments).toEqual(expect.arrayContaining(assignments));
    });
  });

  describe('createTrialAttorneyAssignments', () => {
    const attorneyJaneSmith = 'Jane Smith';
    const attorneyJoeNobel = 'Joe Nobel';
    const caseId = '081-23-01176';
    const role = CaseAssignmentRole.TrialAttorney;

    test('should create new case assignments when none exist on the case', async () => {
      const assignmentUseCase = new CaseAssignmentUseCase(applicationContext);

      findAssignmentsByCaseId.mockResolvedValue([]);

      const assignments = [attorneyJaneSmith, attorneyJoeNobel];
      const response = await assignmentUseCase.createTrialAttorneyAssignments(
        applicationContext,
        caseId,
        assignments,
        role.toString(),
      );

      const assignmentOne = {
        caseId,
        name: attorneyJaneSmith,
        role,
      };

      const assignmentTwo = {
        caseId,
        name: attorneyJoeNobel,
        role,
      };

      expect(createAssignment.mock.calls[0][0]).toEqual(expect.objectContaining(assignmentOne));
      expect(createAssignment.mock.calls[1][0]).toEqual(expect.objectContaining(assignmentTwo));
      expect(response).toEqual(
        expect.objectContaining({
          count: 2,
          body: expect.arrayContaining([expect.any(String), expect.any(String)]),
        }),
      );
    });

    test('should add new case assignments on a case with existing assignments', async () => {
      const assignmentUseCase = new CaseAssignmentUseCase(applicationContext);
      const assignments = [attorneyJaneSmith, attorneyJoeNobel];

      const assignmentOne = {
        caseId,
        name: attorneyJaneSmith,
        role,
      };

      const assignmentTwo = {
        caseId,
        name: attorneyJoeNobel,
        role,
      };

      findAssignmentsByCaseId.mockResolvedValue([assignmentOne]);

      const response = await assignmentUseCase.createTrialAttorneyAssignments(
        applicationContext,
        caseId,
        assignments,
        role.toString(),
      );

      expect(createAssignment.mock.calls[0][0]).toEqual(expect.objectContaining(assignmentTwo));
      expect(createAssignment).toHaveBeenCalledTimes(1);

      expect(response).toEqual(
        expect.objectContaining({
          count: 1,
          body: expect.arrayContaining([expect.any(String)]),
        }),
      );
    });

    test('should remove assignments', async () => {
      const assignmentUseCase = new CaseAssignmentUseCase(applicationContext);
      const assignments = [];

      const assignmentOne = {
        caseId,
        name: attorneyJaneSmith,
        role,
      };

      findAssignmentsByCaseId.mockResolvedValue([assignmentOne]);

      const response = await assignmentUseCase.createTrialAttorneyAssignments(
        applicationContext,
        caseId,
        assignments,
        role.toString(),
      );

      expect(updateAssignment.mock.calls[0][0]).toEqual(expect.objectContaining(assignmentOne));
      expect(updateAssignment).toHaveBeenCalledTimes(1);

      expect(response).toEqual(
        expect.objectContaining({
          count: 0,
          body: [],
        }),
      );
    });
  });
});
