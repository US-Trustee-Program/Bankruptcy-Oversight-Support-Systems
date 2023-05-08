import httpTrigger from './users.function';
import { UsersController } from '../lib/adapters/controllers/users.controller';
import { getProperty } from '../lib/testing/mock-data';
const context = require('../lib/testing/defaultContext');

jest.mock('../lib/adapters/controllers/users.controller', () => {
  return {
    UsersController: jest.fn().mockImplementation(() => {
      return {
        getUser: () => {
          console.log('mock getUser() is being called.');
          throw new Error('Test error');
        },
      }
    })
  }
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
  test('If usersController.getUser() throws an error, then the error should be properly handled', async () => {
    const request = {
      query: {
        first_name: 'Test',
        last_name: 'Person'
      }
    };

    await httpTrigger(context, request);

    expect(context.res.statusCode).toEqual(404);
    expect(context.res.body.error).toEqual('Test error');
  });
});
