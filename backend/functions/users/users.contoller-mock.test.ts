import httpTrigger from './users.function';
import { UsersController } from '../lib/adapters/controllers/users.controller';
import { applicationContextCreator } from '../lib/adapters/utils/application-context-creator';
const context = require('azure-function-context-mock');

const appContext = applicationContextCreator(context);

jest.mock('../lib/adapters/controllers/users.controller', () => {
  return {
    UsersController: jest.fn().mockImplementation(() => {
      return {
        getUser: () => {
          throw new Error('Test error');
        },
      };
    }),
  };
});

describe('Mocking UsersController to get error handling', () => {
  const MockedUsersController = jest.mocked(UsersController);

  beforeEach(() => {
    // Clears the record of calls to the mock constructor function and its methods
    MockedUsersController.mockClear();
  });

  /* will need to mock usersController.getUser() to throw an error so that we can cover
    the error case
  */
  test('error should be properly handled if usersController.getUser() throws an error', async () => {
    const request = {
      query: {
        first_name: 'Test',
        last_name: 'Person',
      },
    };

    await httpTrigger(appContext, request);

    expect(appContext.res.statusCode).toEqual(404);
    expect(appContext.res.body.error).toEqual('Test error');
  });
});
