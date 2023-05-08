import httpTrigger from './cases.function';
import { CasesController } from '../lib/adapters/controllers/cases.controller';
const context = require('../lib/testing/defaultContext');

jest.mock('../lib/adapters/controllers/cases.controller', () => {
  return {
    CasesController: jest.fn().mockImplementation(() => {
      return {
        getCaseList: () => {
          console.log('mock getCaseList() is being called.');
          throw new Error('Test error');
        },
      }
    })
  }
});

describe('Mocking CasesController to get error handling', () => {
  //const MockedCasesController = jest.mocked(CasesController);

  beforeEach(() => {
    // Clears the record of calls to the mock constructor function and its methods
    //MockedCasesController.mockClear();
  });

  /* will need to mock casesController.getCaseList() to throw an error so that we can cover
    the error case
  */
  test('If casesController.getCaseList() throws an error, then the error should be properly handled', async () => {
    const request = {
      query: {}
    };

    await httpTrigger(context, request);

    expect(context.res.statusCode).toEqual(404);
    expect(context.res.body.error).toEqual('Test error');
  });
});
