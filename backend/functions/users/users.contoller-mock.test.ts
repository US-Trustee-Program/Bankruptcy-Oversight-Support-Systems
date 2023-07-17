import httpTrigger from './users.function';
import { UsersController } from '../lib/adapters/controllers/users.controller';
const context = require('../lib/testing/default-context');

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

    await httpTrigger(context, request);

    expect(context.res.statusCode).toEqual(404);
    expect(context.res.body.error).toEqual('Test error');
  });
});
