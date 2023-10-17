const context = require('azure-function-context-mock');
import { ApplicationContext } from '../adapters/types/basic';
import { applicationContextCreator } from '../adapters/utils/application-context-creator';
import AttorneysList from './attorneys';

describe('Test attorneys use-case', () => {
  it('Should use gateway passed to it in constructor', async () => {
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
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      getAttorneys: async (context: ApplicationContext, fields: { officeId: string }) => mockResult,
    };

    const mockContext = await applicationContextCreator(context);
    const caseList = new AttorneysList(gateway);
    const results = await caseList.getAttorneyList(mockContext, {});

    expect(results).toEqual(mockResult);
  });
});
