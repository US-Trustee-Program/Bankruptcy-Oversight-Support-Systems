import { ApplicationContext } from '../adapters/types/basic';
// TODO: investigate the duplicates of ATTORNEYS
import { ATTORNEYS } from '../../../../common/src/cams/test-utilities/attorneys.mock';
import { createMockApplicationContext } from '../testing/testing-utilities';
import AttorneysList from './attorneys';
import { CaseAssignmentUseCase } from './case-assignment';

describe('Test attorneys use-case', () => {
  test('Should use gateway passed to it in constructor', async () => {
    const attorneyUsers = ATTORNEYS;

    const gateway = {
      getAttorneys: async (
        _applicationContext: ApplicationContext,
        _attorneyOtions: { officeId: string },
      ) => attorneyUsers,
    };

    const mockContext = await createMockApplicationContext();
    const caseList = new AttorneysList(gateway);
    const results = await caseList.getAttorneyList(mockContext, {});

    expect(results).toEqual(attorneyUsers);
  });

  test('should log errors when looking up attorney assignments', async () => {
    const attorneyUsers = ATTORNEYS;
    const gateway = {
      getAttorneys: async (
        _applicationContext: ApplicationContext,
        _fields: { officeId: string },
      ) => attorneyUsers,
    };

    const mockContext = await createMockApplicationContext();
    const loggerSpy = jest.spyOn(mockContext.logger, 'error');

    const assignmentUseCaseSpy = jest
      .spyOn(CaseAssignmentUseCase.prototype, 'getCaseLoad')
      .mockRejectedValue(new Error('TEST'));

    const caseList = new AttorneysList(gateway);
    await caseList.getAttorneyList(mockContext, {});

    expect(assignmentUseCaseSpy).toHaveBeenCalled();
    expect(loggerSpy).toHaveBeenCalled();
  });
});
