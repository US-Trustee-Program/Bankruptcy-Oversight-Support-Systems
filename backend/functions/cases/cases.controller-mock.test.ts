import { INTERNAL_SERVER_ERROR } from '../lib/common-errors/constants';
import httpTrigger from './cases.function';
const context = require('azure-function-context-mock');

jest.mock('../lib/adapters/controllers/cases.controller', () => {
  return {
    CasesController: jest.fn().mockImplementation(() => {
      return {
        getCaseList: () => {
          throw new Error('Test error');
        },
      };
    }),
  };
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
  test('error should be properly handled if casesController.getCaseList() throws an error', async () => {
    const request = {
      query: {},
    };

    await httpTrigger(context, request);

    expect(context.res.statusCode).toEqual(INTERNAL_SERVER_ERROR);
    expect(context.res.body.error).toEqual('Test error');
  });
});
