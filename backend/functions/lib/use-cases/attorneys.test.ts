const context = require('azure-function-context-mock');
import { ApplicationContext } from '../adapters/types/basic';
import { applicationContextCreator } from '../adapters/utils/application-context-creator';
import AttorneysList from './attorneys';
import { CaseAssignmentUseCase } from './case.assignment';

describe('Test attorneys use-case', () => {
  test('Should use gateway passed to it in constructor', async () => {
    const mockResult = {
      success: true,
      message: '',
      count: 0,
      body: {
        attorneyList: [
          {
            foo: 'bar',
          },
        ],
      },
    };

    const gateway = {
      getAttorneys: async (
        _applicationContext: ApplicationContext,
        _fields: { officeId: string },
      ) => mockResult,
    };

    const mockContext = await applicationContextCreator(context);
    const caseList = new AttorneysList(gateway);
    const results = await caseList.getAttorneyList(mockContext, {});

    expect(results).toEqual(mockResult);
  });

  test('should log errors when looking up attorney assignments', async () => {
    const mockResult = {
      success: true,
      message: '',
      count: 0,
      body: {
        attorneyList: [
          {
            foo: 'bar',
          },
        ],
      },
    };

    const gateway = {
      getAttorneys: async (
        _applicationContext: ApplicationContext,
        _fields: { officeId: string },
      ) => mockResult,
    };

    const mockContext = await applicationContextCreator(context);
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
