import { CaseAssignmentController } from './case.assignment.controller';
import { applicationContextCreator } from '../utils/application-context-creator';
import { THROW_PERMISSIONS_ERROR_CASE_ID } from '../../testing/testing-constants';
import { MockData } from '../../../../../common/src/cams/test-utilities/mock-data';
import { CaseAssignment } from '../../../../../common/src/cams/assignments';
import { ApplicationContext } from '../types/basic';

const functionContext = require('azure-function-context-mock');

describe('Case Assignment Creation Tests', () => {
  const env = process.env;
  const trialAttorneyRole = 'TrialAttorney';
  let applicationContext;
  beforeEach(async () => {
    jest.mock('../../use-cases/case.assignment', () => {
      return {
        CaseAssignmentUseCase: jest
          .fn()
          .mockImplementation((_applicationContext: ApplicationContext) => {
            return {
              getTrialAttorneyAssignments: (
                _applicationContext: ApplicationContext,
                _caseId: string,
              ) => {
                return Promise.resolve(MockData.getAttorneyAssignments(3));
              },
            };
          }),
      };
    });

    process.env = {
      ...env,
      DATABASE_MOCK: 'true',
    };
    applicationContext = await applicationContextCreator(functionContext);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('A case is assigned to an attorney when requested', async () => {
    const listOfAttorneyNames = ['Jane'];
    const testCaseAssignment = {
      caseId: '001-18-12345',
      listOfAttorneyNames,
      role: trialAttorneyRole,
    };

    const assignmentController = new CaseAssignmentController(applicationContext);
    const assignmentResponse =
      await assignmentController.createTrialAttorneyAssignments(testCaseAssignment);

    expect(assignmentResponse.body.length).toBe(listOfAttorneyNames.length);
    expect(assignmentResponse).toEqual(
      expect.objectContaining({
        success: true,
        message: 'Trial attorney assignments created.',
        count: listOfAttorneyNames.length,
        body: expect.any(Array<string>),
      }),
    );
  });

  test('should assign all attorneys in the list', async () => {
    const listOfAttorneyNames = ['Jane', 'Tom', 'Adrian'];
    const testCaseAssignment = {
      caseId: '001-18-12345',
      listOfAttorneyNames,
      role: trialAttorneyRole,
    };

    const assignmentController = new CaseAssignmentController(applicationContext);
    const assignmentResponse =
      await assignmentController.createTrialAttorneyAssignments(testCaseAssignment);

    expect(assignmentResponse.body.length).toBe(listOfAttorneyNames.length);
    expect(assignmentResponse).toEqual(
      expect.objectContaining({
        success: true,
        message: 'Trial attorney assignments created.',
        count: listOfAttorneyNames.length,
        body: expect.any(Array<string>),
      }),
    );
  });

  test('should create only one assignment per attorney', async () => {
    const listOfAttorneyNames = ['Jane', 'Tom', 'Jane', 'Adrian', 'Tom'];
    const testCaseAssignment = {
      caseId: '001-18-12345',
      listOfAttorneyNames,
      role: trialAttorneyRole,
    };

    const expectedNumberOfAssignees = Array.from(new Set(listOfAttorneyNames)).length;
    const assignmentController = new CaseAssignmentController(applicationContext);
    const assignmentResponse =
      await assignmentController.createTrialAttorneyAssignments(testCaseAssignment);

    expect(assignmentResponse.body.length).toBe(expectedNumberOfAssignees);
    expect(assignmentResponse).toEqual(
      expect.objectContaining({
        success: true,
        message: 'Trial attorney assignments created.',
        count: expectedNumberOfAssignees,
        body: expect.any(Array<string>),
      }),
    );
  });

  test('should fetch a list of assignments when a GET request is called', async () => {
    const mockAssignments: CaseAssignment[] = MockData.getAttorneyAssignments(3);

    /*
    jest.mock('../../use-cases/case.assignment', () => {
      return {
        CaseAssignmentUseCase: jest
          .fn()
          .mockImplementation((_applicationContext: ApplicationContext) => {
            return {
              getTrialAttorneyAssignments: (
                _applicationContext: ApplicationContext,
                _caseId: string,
              ) => {
                return Promise.resolve(mockAssignments);
              },
            };
          }),
      };
    });
    */

    const assignmentController = new CaseAssignmentController(applicationContext);
    expect(assignmentController.getTrialAttorneyAssignments('001-18-12345')).toHaveReturnedWith(
      mockAssignments,
    );
  });

  test('should throw a CAMS permission error', async () => {
    const testCaseAssignment = {
      caseId: THROW_PERMISSIONS_ERROR_CASE_ID,
      listOfAttorneyNames: [],
      role: trialAttorneyRole,
    };

    const assignmentController = new CaseAssignmentController(applicationContext);

    await expect(
      assignmentController.createTrialAttorneyAssignments(testCaseAssignment),
    ).rejects.toThrow('Failed to authenticate to Azure');
  });
});
