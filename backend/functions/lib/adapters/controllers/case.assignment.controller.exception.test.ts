import { describe } from 'node:test';
import { THROW_UNKNOWN_ERROR_CASE_ID } from '../../cosmos-humble-objects/fake.cosmos-client-humble';
import { CaseAssignmentController } from './case.assignment.controller';
import { ApplicationContext } from '../types/basic';
import { createMockApplicationContext } from '../../testing/testing-utilities';

jest.mock('../../use-cases/case.assignment', () => {
  return {
    CaseAssignmentUseCase: jest.fn().mockImplementation(() => {
      return {
        createTrialAttorneyAssignments: () => {
          throw Error('foo');
        },
      };
    }),
  };
});

describe('test case assignment controller using mocked use case', () => {
  let applicationContext: ApplicationContext;
  const trialAttorneyRole = 'TrialAttorney';

  beforeEach(async () => {
    applicationContext = await createMockApplicationContext({ DATABASE_MOCK: 'true' });
  });

  test('should throw an UnknownError when an error that is not a CamsError is caught', async () => {
    const testCaseAssignment = {
      caseId: THROW_UNKNOWN_ERROR_CASE_ID,
      listOfAttorneyNames: [],
      role: trialAttorneyRole,
    };

    const assignmentController = new CaseAssignmentController(applicationContext);

    await expect(
      assignmentController.createTrialAttorneyAssignments(testCaseAssignment),
    ).rejects.toThrow('Unknown error');
  });
});
